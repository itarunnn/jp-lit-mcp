import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getExportsRoot } from "./paths.js";
import type { FileCache } from "./fileCache.js";
import type { CacheEnvelope, SessionDocument } from "./types.js";

export interface SessionExporter {
  exportSession(input: {
    session: SessionDocument;
    format: "markdown" | "json";
    outputPath?: string;
    includeUnselected: boolean;
  }): Promise<{ path: string; itemCount: number }>;
}

function defaultExportPath(
  baseDir: string,
  sessionId: string,
  format: "markdown" | "json"
) {
  const extension = format === "markdown" ? "md" : "json";
  return path.join(getExportsRoot(baseDir), `${sessionId}.${extension}`);
}

function extractUnselectedItems(envelope: CacheEnvelope<unknown> | null) {
  if (!envelope) {
    return [];
  }

  const structuredContent = envelope.structured_content as {
    items?: Array<Record<string, unknown>>;
  };

  if (!Array.isArray(structuredContent?.items)) {
    return [];
  }

  return structuredContent.items;
}

function buildSelectedKey(source: unknown, sourceId: unknown) {
  if (typeof source !== "string" || typeof sourceId !== "string") {
    return null;
  }

  return `${source}::${sourceId}`;
}

function filterUnselectedItems(
  items: Array<Record<string, unknown>>,
  selectedItems: SessionDocument["entries"][number]["selected_items"]
) {
  const selectedKeys = new Set(
    selectedItems
      .map((item) => buildSelectedKey(item.source, item.source_id))
      .filter((value): value is string => value !== null)
  );

  return items.filter((item) => {
    const key = buildSelectedKey(item.source, item.source_id);
    return key === null || !selectedKeys.has(key);
  });
}

function renderUnselectedItem(item: Record<string, unknown>) {
  const title =
    typeof item.title === "string" && item.title.trim().length > 0
      ? item.title
      : "(untitled)";
  const source =
    typeof item.source === "string" && item.source.trim().length > 0
      ? item.source
      : "unknown";
  const sourceId =
    typeof item.source_id === "string" && item.source_id.trim().length > 0
      ? item.source_id
      : "unknown";

  return `- ${title} (${source}/${sourceId})`;
}

function renderMarkdown(
  session: SessionDocument,
  includeUnselected: boolean,
  unresolvedItems: Map<string, Array<Record<string, unknown>>>
) {
  const lines: string[] = [
    `# Session ${session.session_id}`,
    "",
    `- Created: ${session.created_at}`,
    `- Updated: ${session.updated_at}`,
    ""
  ];

  for (const entry of session.entries) {
    lines.push(`## ${entry.tool}`);
    lines.push("");
    lines.push("### Input");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(entry.input, null, 2));
    lines.push("```");
    lines.push("");

    if (entry.selected_items.length > 0) {
      lines.push("### Selected Items");
      lines.push("");

      for (const item of entry.selected_items) {
        lines.push(
          `- [${item.label}] ${item.title} (${item.source}/${item.source_id})${
            item.note ? ` - ${item.note}` : ""
          }`
        );
      }

      lines.push("");
    }

    if (entry.notes.length > 0) {
      lines.push("### Notes");
      lines.push("");
      for (const note of entry.notes) {
        lines.push(`- ${note}`);
      }
      lines.push("");
    }

    if (includeUnselected) {
      const unselectedItems = filterUnselectedItems(
        unresolvedItems.get(entry.cache_key) ?? [],
        entry.selected_items
      );

      if (unselectedItems.length > 0) {
        lines.push("### Unselected Results");
        lines.push("");
        for (const item of unselectedItems) {
          lines.push(renderUnselectedItem(item));
        }
      } else {
        lines.push(
          `- Cached result reference: ${entry.result_ref.tool}/${entry.result_ref.cache_key}`
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function createSessionExporter(
  cache: FileCache,
  baseDir = process.cwd()
): SessionExporter {
  return {
    async exportSession({ session, format, outputPath, includeUnselected }) {
      const target = outputPath ?? defaultExportPath(baseDir, session.session_id, format);
      const unresolvedItems = new Map<string, Array<Record<string, unknown>>>();

      await mkdir(path.dirname(target), { recursive: true });

      if (includeUnselected) {
        for (const entry of session.entries) {
          const envelope = await cache.read<unknown>(entry.result_ref.tool, entry.result_ref.cache_key);
          unresolvedItems.set(entry.cache_key, extractUnselectedItems(envelope));
        }
      }

      const itemCount = session.entries.reduce((sum, entry) => {
        const selectedCount = entry.selected_items.length;
        const unselectedCount = includeUnselected
          ? filterUnselectedItems(
              unresolvedItems.get(entry.cache_key) ?? [],
              entry.selected_items
            ).length
          : 0;

        return sum + selectedCount + unselectedCount;
      }, 0);

      if (format === "json") {
        const payload = includeUnselected
          ? {
              ...session,
              entries: session.entries.map((entry) => ({
                ...entry,
                unselected_items: filterUnselectedItems(
                  unresolvedItems.get(entry.cache_key) ?? [],
                  entry.selected_items
                )
              }))
            }
          : session;

        await writeFile(target, JSON.stringify(payload, null, 2), "utf8");
      } else {
        await writeFile(
          target,
          renderMarkdown(session, includeUnselected, unresolvedItems),
          "utf8"
        );
      }

      return {
        path: target,
        itemCount
      };
    }
  };
}
