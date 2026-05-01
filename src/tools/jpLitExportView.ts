import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getExportsRoot } from "../lib/persistence/paths.js";
import {
  exportViewInputSchema,
  exportViewOutputSchema
} from "../lib/schemas.js";
import type {
  ExportViewOutput,
  ListCacheOutput,
  RefineResultsOutput,
  SearchCacheIndexOutput
} from "../lib/schemas.js";

type ViewOutput = ListCacheOutput | SearchCacheIndexOutput | RefineResultsOutput;

export interface ViewTools {
  listCache(input: unknown): Promise<{ structuredContent: ListCacheOutput }>;
  searchCacheIndex(input: unknown): Promise<{ structuredContent: SearchCacheIndexOutput }>;
  refineResults(input: unknown): Promise<{ structuredContent: RefineResultsOutput }>;
}

function defaultExportPath(
  baseDir: string,
  view: "cache_list" | "cache_query" | "refined_results",
  format: "markdown" | "json"
) {
  const extension = format === "markdown" ? "md" : "json";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(getExportsRoot(baseDir), `${view}.${stamp}.${extension}`);
}

function resolveItemCount(view: "cache_list" | "cache_query" | "refined_results", output: ViewOutput) {
  if (view === "refined_results") {
    const payload = output as RefineResultsOutput;
    return payload.total_after;
  }
  const payload = output as ListCacheOutput | SearchCacheIndexOutput;
  return payload.total;
}

function renderMarkdown(
  view: "cache_list" | "cache_query" | "refined_results",
  output: ViewOutput,
  exportedAt: string
) {
  const itemCount = resolveItemCount(view, output);
  const lines = [
    "# Cache View Export",
    "",
    `- View: ${view}`,
    `- Exported at: ${exportedAt}`,
    `- Item count: ${itemCount}`,
    "",
    "## Structured Content",
    "",
    "```json",
    JSON.stringify(output, null, 2),
    "```",
    ""
  ];
  return lines.join("\n");
}

export function createJpLitExportViewTool(
  tools: ViewTools,
  baseDir = process.cwd()
) {
  return async (input: unknown) => {
    const parsed = exportViewInputSchema.parse(input);
    let output: ViewOutput;
    if (parsed.view === "cache_list") {
      const result = await tools.listCache(parsed.params);
      output = result.structuredContent;
    } else if (parsed.view === "cache_query") {
      const result = await tools.searchCacheIndex(parsed.params);
      output = result.structuredContent;
    } else {
      const result = await tools.refineResults(parsed.params);
      output = result.structuredContent;
    }

    const target =
      parsed.output_path ??
      defaultExportPath(baseDir, parsed.view, parsed.format);
    const exportedAt = new Date().toISOString();
    const itemCount = resolveItemCount(parsed.view, output);

    await mkdir(path.dirname(target), { recursive: true });
    if (parsed.format === "json") {
      await writeFile(target, JSON.stringify(output, null, 2), "utf8");
    } else {
      await writeFile(target, renderMarkdown(parsed.view, output, exportedAt), "utf8");
    }

    const structuredContent: ExportViewOutput = exportViewOutputSchema.parse({
      view: parsed.view,
      format: parsed.format,
      path: target,
      exported_at: exportedAt,
      item_count: itemCount
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  };
}
