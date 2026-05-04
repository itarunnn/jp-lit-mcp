import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getExportsRoot } from "./paths.js";
import type { FileCache } from "./fileCache.js";
import type { CacheEnvelope, SessionDocument } from "./types.js";
import {
  extractCslSourceItems,
  findCslSourceItem,
  toCslItem,
  toFallbackSelectedItem
} from "./cslJson.js";

export interface SessionExporter {
  exportSession(input: {
    session: SessionDocument;
    format: "markdown" | "json" | "csl-json";
    profile: "full_log" | "selected" | "unselected";
    outputPath?: string;
    includeUnselected: boolean;
  }): Promise<{ path: string; itemCount: number }>;
}

function defaultExportPath(
  baseDir: string,
  sessionId: string,
  profile: "full_log" | "selected" | "unselected",
  format: "markdown" | "json" | "csl-json"
) {
  const extension = format === "markdown" ? "md" : format === "csl-json" ? "csl.json" : "json";
  const basename =
    profile === "full_log" ? sessionId : `${sessionId}.${profile}`;
  return path.join(getExportsRoot(baseDir), `${basename}.${extension}`);
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
  profile: "full_log" | "selected" | "unselected",
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

    const selectedItems = profile === "selected" || profile === "full_log"
      ? entry.selected_items
      : [];

    if (selectedItems.length > 0) {
      lines.push("### Selected Items");
      lines.push("");

      for (const item of selectedItems) {
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

    if ((profile === "full_log" && includeUnselected) || profile === "unselected") {
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

function filterSelectedItems(
  entry: SessionDocument["entries"][number],
  profile: "full_log" | "selected" | "unselected"
) {
  if (profile === "unselected") {
    return [];
  }

  return entry.selected_items;
}

async function readEntryItems(
  cache: FileCache,
  entry: SessionDocument["entries"][number]
) {
  const envelope = await cache.read<unknown>(entry.result_ref.tool, entry.result_ref.cache_key);
  return extractCslSourceItems(envelope);
}

export function createSessionExporter(
  cache: FileCache,
  baseDir = process.cwd()
): SessionExporter {
  return {
    async exportSession({ session, format, profile, outputPath, includeUnselected }) {
      const target =
        outputPath ??
        defaultExportPath(baseDir, session.session_id, profile, format);
      const unresolvedItems = new Map<string, Array<Record<string, unknown>>>();

      await mkdir(path.dirname(target), { recursive: true });

      if ((profile === "full_log" && includeUnselected) || profile === "unselected") {
        for (const entry of session.entries) {
          const envelope = await cache.read<unknown>(entry.result_ref.tool, entry.result_ref.cache_key);
          unresolvedItems.set(entry.cache_key, extractUnselectedItems(envelope));
        }
      }

      let itemCount = session.entries.reduce((sum, entry) => {
        const selectedCount = filterSelectedItems(entry, profile).length;
        const shouldCountUnselected =
          format !== "csl-json" && profile === "full_log" && includeUnselected;
        const unselectedCount = shouldCountUnselected || profile === "unselected"
          ? filterUnselectedItems(
              unresolvedItems.get(entry.cache_key) ?? [],
              entry.selected_items
            ).length
          : 0;

        return sum + selectedCount + unselectedCount;
      }, 0);

      if (format === "csl-json") {
        const cslItems = [];

        for (const entry of session.entries) {
          const cachedItems = await readEntryItems(cache, entry);

          for (const selectedItem of filterSelectedItems(entry, profile)) {
            cslItems.push(toCslItem(selectedItem, findCslSourceItem(cachedItems, selectedItem)));
          }

          if (profile === "unselected") {
            for (const unselectedItem of filterUnselectedItems(cachedItems, entry.selected_items)) {
              cslItems.push(toCslItem(toFallbackSelectedItem(unselectedItem), unselectedItem));
            }
          }
        }

        itemCount = cslItems.length;
        await writeFile(target, JSON.stringify(cslItems, null, 2), "utf8");
      } else if (format === "json") {
        const payload = {
          ...session,
          entries: session.entries.map((entry) => {
            const baseEntry = {
              ...entry,
              selected_items: filterSelectedItems(entry, profile)
            };

            if ((profile === "full_log" && includeUnselected) || profile === "unselected") {
              return {
                ...baseEntry,
                unselected_items: filterUnselectedItems(
                  unresolvedItems.get(entry.cache_key) ?? [],
                  entry.selected_items
                )
              };
            }

            return baseEntry;
          })
        };

        await writeFile(target, JSON.stringify(payload, null, 2), "utf8");
      } else {
        await writeFile(
          target,
          renderMarkdown(session, profile, includeUnselected, unresolvedItems),
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
