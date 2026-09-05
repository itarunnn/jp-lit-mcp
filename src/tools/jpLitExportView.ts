import path from "node:path";

import { latestBrowserObservation } from "../lib/candidateResultHelpers.js";
import { resolveExportTarget, writeExportFile } from "../lib/persistence/exportPath.js";
import { getExportsRoot } from "../lib/persistence/paths.js";
import {
  exportViewInputSchema,
  exportViewOutputSchema
} from "../lib/schemas.js";
import type {
  ExportViewInput,
  ExportViewOutput,
  ListCacheOutput,
  RefineResultsOutput,
  SearchOutput,
  SearchCacheIndexOutput
} from "../lib/schemas.js";

type ViewOutput = ListCacheOutput | SearchCacheIndexOutput | RefineResultsOutput;

const ORIGIN_LABELS: Record<string, string> = {
  jp_lit_search: "NDL Search API",
  next_digital_library_fulltext: "次世代デジタルライブラリー全文検索",
  ndl_digital_browser: "デジコレ全文検索（ブラウザ）"
};

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
  if (view === "refined_results") {
    return renderRefinedResultsMarkdown(output as RefineResultsOutput, exportedAt);
  }

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function renderItemProvenance(item: SearchOutput["items"][number]) {
  const sourceMetadata = asRecord(item.source_metadata);
  if (!sourceMetadata) return [];

  const origins = Array.isArray(sourceMetadata.candidate_origins)
    ? sourceMetadata.candidate_origins
        .map(readString)
        .filter((origin): origin is string => origin !== null)
    : [];
  const lines: string[] = [];
  if (origins.length > 0) {
    lines.push(`- Acquisition: ${origins.map((origin) => ORIGIN_LABELS[origin] ?? origin).join(", ")}`);
  }

  const observations = Array.isArray(sourceMetadata.browser_observations)
    ? sourceMetadata.browser_observations
        .map(asRecord)
        .filter((observation): observation is Record<string, unknown> => observation !== null)
    : [];
  const latest = latestBrowserObservation(observations);
  if (!latest) return lines;

  const hitLocations = Array.isArray(latest.hit_locations)
    ? latest.hit_locations
        .map(readString)
        .filter((location): location is string => location !== null)
    : [];
  lines.push(
    `- Browser checked at: ${readString(latest.checked_at) ?? "-"}`,
    `- Access: ${readString(latest.access_label) ?? readString(latest.access_scope) ?? "-"}`,
    `- Item fulltext: ${readString(latest.item_fulltext_state) ?? "-"}`,
    `- Content: ${readString(latest.content_state) ?? "-"}`,
    `- Print PDF: ${readString(latest.print_file_state) ?? "-"}`,
    `- Hit locations: ${hitLocations.join(", ") || "-"}`
  );
  return lines;
}

function renderSearchItem(item: SearchOutput["items"][number], index: number) {
  const authors = item.authors.map((author) => author.name).join(", ") || "-";
  return [
    `### ${index}. ${item.title}`,
    "",
    `- Source: ${item.source}`,
    `- Source ID: ${item.source_id}`,
    `- Authors: ${authors}`,
    `- Issued: ${item.issued_at_label ?? item.issued_at ?? "-"}`,
    `- Publisher/Journal: ${item.publisher ?? item.journal_title ?? "-"}`,
    `- URL: ${item.url ?? "-"}`,
    `- Duplicate key: ${item.duplicate_key ?? "-"}`,
    ...renderItemProvenance(item),
    ""
  ];
}

type ClusterEnrichment = NonNullable<
  NonNullable<RefineResultsOutput["clusters"]>[number]["enrichment"]
>;

function renderProviderStatuses(providers: ClusterEnrichment["providers"]) {
  return (["crossref", "openalex"] as const)
    .map((provider) => {
      const status = providers?.[provider];
      return status ? `${provider}=${status.status}(${status.item_count})` : null;
    })
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function renderRefinedResultsMarkdown(output: RefineResultsOutput, exportedAt: string) {
  const baseResultRefs = output.base_result_refs?.length
    ? output.base_result_refs
    : output.base_result_ref
      ? [output.base_result_ref]
      : [];
  const lines = [
    "# Refined Results Export",
    "",
    `- Exported at: ${exportedAt}`,
    `- Base cache keys: ${output.base_cache_keys.join(", ")}`,
    ...(baseResultRefs.length > 0
      ? [`- Base result refs: ${baseResultRefs
          .map((ref) => `${ref.tool}/${ref.cache_key}`)
          .join(", ")}`]
      : []),
    `- Combine: ${output.combine}`,
    `- Key by: ${output.key_by}`,
    `- Total before: ${output.total_before}`,
    `- Total after: ${output.total_after}`,
    `- Exported item count: ${output.items.length}`,
    ""
  ];

  if (output.cluster_summary) {
    lines.push(
      "## Duplicate Cluster Summary",
      "",
      "重複クラスタは自動削除ではありません。同一性と採否はユーザーが確認してください。",
      "",
      `- Items considered: ${output.cluster_summary.total_items_considered}`,
      `- Cluster count: ${output.cluster_summary.cluster_count}`,
      `- Returned clusters: ${output.cluster_summary.returned_cluster_count}`,
      `- Strong/Medium/Weak: ${output.cluster_summary.strong_cluster_count}/${output.cluster_summary.medium_cluster_count}/${output.cluster_summary.weak_cluster_count}`,
      ""
    );
  }

  if (output.clusters?.length) {
    lines.push("## Duplicate Clusters", "");
    output.clusters.forEach((cluster, index) => {
      lines.push(
        `### Cluster ${index + 1}: ${cluster.representative.title}`,
        "",
        `- Cluster ID: ${cluster.cluster_id}`,
        `- Confidence: ${cluster.duplicate_confidence}`,
        `- Member count: ${cluster.member_count}`,
        `- Reasons: ${cluster.reasons.join(", ")}`,
        `- Search result readiness: ${cluster.search_result_readiness.level}`,
        `- Missing: ${cluster.search_result_readiness.missing.join(", ") || "-"}`,
        ""
      );
      if (cluster.enrichment) {
        lines.push(
          "External enrichment:",
          "",
          `- DOI: ${cluster.enrichment.identifiers.doi ?? "-"}`,
          `- Enrichment confidence: ${cluster.enrichment.match_confidence}`,
          `- Bibliographic evidence: ${cluster.enrichment.evidence_level.bibliographic}`,
          `- Provider statuses: ${renderProviderStatuses(cluster.enrichment.providers) || "-"}`,
          `- Enrichment cache keys: ${cluster.enrichment.matched_cache_keys.join(", ") || "-"}`,
          ""
        );
      }
      lines.push(
        "Representative:",
        "",
        ...renderSearchItem(cluster.representative, 1),
        "Members preview:",
        ""
      );
      cluster.members_preview.forEach((member, memberIndex) => {
        lines.push(...renderSearchItem(member, memberIndex + 1));
      });
      if (cluster.omitted_member_count > 0) {
        lines.push(`- Omitted members: ${cluster.omitted_member_count}`, "");
      }
    });
  }

  lines.push("## Items", "");
  output.items.forEach((item, index) => {
    lines.push(...renderSearchItem(item, index + 1));
  });
  return lines.join("\n");
}

async function readAllRefinedResults(
  tools: ViewTools,
  params: RefinedResultsParams
): Promise<RefineResultsOutput> {
  const pageSize = 200;
  const first = await tools.refineResults({ ...params, limit: pageSize, offset: 0 });
  const firstOutput = first.structuredContent;
  const items = [...firstOutput.items];
  for (let offset = pageSize; offset < firstOutput.total_after; offset += pageSize) {
    const page = await tools.refineResults({ ...params, limit: pageSize, offset });
    items.push(...page.structuredContent.items);
  }
  return {
    ...firstOutput,
    limit: pageSize,
    offset: 0,
    items
  };
}

async function resolveRefinedResultsOutput(
  tools: ViewTools,
  parsed: Extract<ExportViewInput, { view: "refined_results" }>
) {
  const baseOutput = parsed.export_all
    ? await readAllRefinedResults(tools, parsed.params)
    : (await tools.refineResults(parsed.params)).structuredContent;

  if (!parsed.duplicate_notes) return baseOutput;

  const rawSourceItemCount = baseOutput.totals_by_base.reduce(
    (sum, entry) => sum + entry.total,
    0
  );
  const clusterParams = {
    ...parsed.params,
    include_duplicate_clusters: true,
    cluster_limit: Math.max(1, rawSourceItemCount),
    cluster_offset: 0,
    cluster_member_limit: Math.max(1, rawSourceItemCount)
  };
  const clusteredOutput = parsed.export_all
    ? await readAllRefinedResults(tools, clusterParams)
    : (await tools.refineResults(clusterParams)).structuredContent;

  return {
    ...clusteredOutput,
    items: baseOutput.items
  };
}

type RefinedResultsParams = Extract<ExportViewInput, { view: "refined_results" }>["params"];

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
      output = await resolveRefinedResultsOutput(tools, parsed);
    }

    const target = await resolveExportTarget({
      baseDir,
      outputPath: parsed.output_path ?? defaultExportPath(baseDir, parsed.view, parsed.format),
      allowExternalPath: parsed.allow_external_path
    });
    const exportedAt = new Date().toISOString();
    const itemCount = resolveItemCount(parsed.view, output);

    if (parsed.format === "json") {
      await writeExportFile(target, JSON.stringify(output, null, 2), parsed.overwrite, {
        baseDir,
        allowExternalPath: parsed.allow_external_path
      });
    } else {
      await writeExportFile(
        target,
        renderMarkdown(parsed.view, output, exportedAt),
        parsed.overwrite,
        { baseDir, allowExternalPath: parsed.allow_external_path }
      );
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
