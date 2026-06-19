import { z } from "zod";

export const sourceSchema = z.enum([
  "ndl_search",
  "ndl_catalog",
  "ndl_digital",
  "ndl_articles",
  "ndl_articles_online",
  "irdb",
  "jdcat",
  "jstage_articles",
  "japan_search",
  "cinii_articles",
  "cinii_books",
  "kokkai_minutes",
  "teikoku_minutes",
  "nihu_bridge",
  "national_archives",
  "jacar",
  "nijl_articles",
  "kokusho",
  "ninjal_bibliography"
]);
export const issuedAtPrecisionSchema = z.enum(["day", "month", "year", "unknown"]);

const personRoleSchema = z.object({
  name: z.string(),
  role: z.string().nullable()
});

const availabilitySchema = z.object({
  online: z.boolean(),
  digital_collection: z.boolean()
});

const contentAccessSchema = z.object({
  has_page_images: z.boolean(),
  has_text_coordinates: z.boolean(),
  viewer_url: z.string().nullable(),
  access_note: z.string().nullable()
});

const relatedSearchRecordSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  url: z.string().nullable()
});

const facetsSchema = z.object({
  providers: z.record(z.string(), z.number()),
  ndc: z.record(z.string(), z.number()),
  issued_years: z.record(z.string(), z.number())
});

const toolCacheSchema = z.object({
  hit: z.boolean(),
  cache_key: z.string(),
  saved_at: z.string(),
  refresh_hint: z.string().nullable()
});

const sourceInputFieldSchema = sourceSchema.describe(
  "検索・取得・記録対象の情報源ID。jp_lit_search の結果や source plan に含まれる source を指定する。"
);

const optionalSourceInputFieldSchema = sourceSchema.optional().describe(
  "結果を特定 source に絞る。未指定の場合は tool ごとの既定動作に従う。"
);

const forceRefreshFieldSchema = z.boolean().default(false).describe(
  "true の場合はローカル cache を使わず upstream API から再取得する。false の場合は保存済み cache を優先する。"
);

const sessionIdInputFieldSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}-\d{6}$/)
  .describe("調査セッションID。形式は YYYY-MM-DD-HHMMSS。過去セッションを指定して絞り込むときだけ使う。");

const cacheKeyInputFieldSchema = z
  .string()
  .trim()
  .min(1)
  .describe("保存済み tool 実行結果を指す cache_key。jp_lit_search や cache 一覧 tool の戻り値から渡す。");

export const searchItemSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  title_reading: z.string().nullable(),
  authors: z.array(personRoleSchema),
  publisher: z.string().nullable(),
  journal_title: z.string().nullable(),
  issued_at: z.string().nullable(),
  issued_at_label: z.string().nullable(),
  issued_at_precision: issuedAtPrecisionSchema,
  summary: z.string().nullable(),
  url: z.string().nullable(),
  availability: availabilitySchema,
  material_type: z.string().nullable(),
  subjects: z.array(z.string()),
  table_of_contents: z.array(z.string()),
  source_metadata: z.record(z.unknown()).optional(),
  duplicate_key: z.string().nullable(),
  duplicate_count: z.number().int().positive(),
  related_records: z.array(relatedSearchRecordSchema)
});

export const recordItemSchema = z.object({
  source: sourceSchema,
  source_id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  title_reading: z.string().nullable(),
  authors: z.array(personRoleSchema),
  publisher: z.string().nullable(),
  journal_title: z.string().nullable(),
  issued_at: z.string().nullable(),
  issued_at_label: z.string().nullable(),
  issued_at_precision: issuedAtPrecisionSchema,
  summary: z.string().nullable(),
  url: z.string().nullable(),
  availability: availabilitySchema,
  alternative_titles: z.array(z.string()),
  publication_place: z.string().nullable(),
  language: z.string().nullable(),
  material_type: z.string().nullable(),
  extent: z.string().nullable(),
  subjects: z.array(z.string()),
  identifiers: z.record(z.unknown()),
  table_of_contents: z.array(z.string()),
  content_access: contentAccessSchema,
  source_metadata: z.record(z.unknown()),
  raw: z.record(z.unknown())
});

export const irdbFiltersSchema = z.object({
  fulltext: z.boolean().optional().describe("IRDB で本文ありの資料に絞る場合は true を指定する。"),
  title: z.string().optional().describe("IRDB のタイトル欄を絞る語。"),
  author: z.string().optional().describe("IRDB の著者・作成者欄を絞る語。"),
  keyword: z.string().optional().describe("IRDB のキーワード・主題欄を絞る語。"),
  journal: z.string().optional().describe("IRDB の掲載誌名で絞る語。"),
  publisher: z.string().optional().describe("IRDB の出版者・機関名で絞る語。")
});

export const nihuBridgeInstituteSchema = z.enum([
  "nijl", "nmjh", "ninjal", "ircjs", "rihn", "nme", "nihu"
]);

export const nihuBridgeBboxSchema = z.object({
  lat1: z.number().describe("地理範囲の緯度 1。"),
  lon1: z.number().describe("地理範囲の経度 1。"),
  lat2: z.number().describe("地理範囲の緯度 2。"),
  lon2: z.number().describe("地理範囲の経度 2。")
});

export const nihuBridgeFiltersSchema = z.object({
  institute: z.array(nihuBridgeInstituteSchema).optional().describe("NIHU Bridge の institute ID 配列。分かっている場合だけ指定する。"),
  database: z.array(z.string()).optional().describe("NIHU Bridge の database ID 配列。特定データベースに絞る場合に使う。"),
  normalize: z.boolean().optional().describe("NIHU Bridge の正規化検索を使うかどうか。"),
  period_from: z.string().optional().describe("時代・年代範囲の下限。"),
  period_to: z.string().optional().describe("時代・年代範囲の上限。"),
  bbox: nihuBridgeBboxSchema.optional().describe("地理範囲を lat/lon の bounding box で絞る。")
});

export const jdcatFiltersSchema = z.object({
  subject: z.string().optional().describe("JDCat の subject による絞り込み。"),
  geographic: z.string().optional().describe("JDCat の geographic coverage による絞り込み。"),
  contributor: z.string().optional().describe("JDCat の contributor による絞り込み。"),
  title: z.string().optional().describe("JDCat の title による絞り込み。"),
  temporal: z.string().optional().describe("JDCat の temporal coverage による絞り込み。"),
  creator: z.string().optional().describe("JDCat の creator による絞り込み。")
});

export const ndlFiltersSchema = z.object({
  subject: z.string().optional().describe("NDL 系 source の件名による絞り込み。"),
  ndc: z.string().optional().describe("NDL 系 source の NDC 分類記号による絞り込み。"),
  ndlc: z.string().optional().describe("NDL 系 source の NDLC 分類記号による絞り込み。")
});

export const searchInputToolSchema = z.object({
  query: z.string().trim().min(1).describe("検索語。資料名、著者名、主題語、機関名などを指定する。"),
  source: optionalSourceInputFieldSchema.describe("検索対象 source。未指定なら既定の 8 source 横断検索になるが、新規テーマの初手では通常 ndl_search と japan_search などを明示指定する。"),
  limit: z.number().int().positive().max(100).optional().describe("1 回の検索で返す最大件数。最大 100。未指定時は source ごとの既定値を使う。"),
  page: z.number().int().positive().default(1).describe("検索結果ページ番号。1 始まり。"),
  sort_by: z
    .enum(["title", "creator", "issued_date", "created_date", "modified_date"])
    .optional()
    .describe("source が対応する場合の並び替え項目。未対応 source では無視されることがある。"),
  sort_order: z.enum(["asc", "desc"]).optional().describe("sort_by 指定時の昇順 asc / 降順 desc。"),
  force_refresh: forceRefreshFieldSchema,
  issued_from: z.string().optional().describe("刊行年・日付の下限。年だけの '1900' など source が扱う文字列表現で指定する。"),
  issued_to: z.string().optional().describe("刊行年・日付の上限。issued_from と組み合わせて範囲指定する。"),
  filters: z.object({
    irdb: irdbFiltersSchema.optional().describe("source=irdb のときだけ有効な追加 filter。"),
    nihu_bridge: nihuBridgeFiltersSchema.optional().describe("source=nihu_bridge のときだけ有効な追加 filter。"),
    jdcat: jdcatFiltersSchema.optional().describe("source=jdcat のときだけ有効な追加 filter。"),
    ndl: ndlFiltersSchema.optional().describe("NDL 系 source のときだけ有効な追加 filter。")
  }).optional().describe("source 固有の追加 filter。対象 source と一致しない filter は validation error になる。")
});

export const searchInputSchema = searchInputToolSchema
  .superRefine((data, ctx) => {
    if (data.filters?.irdb !== undefined && data.source !== "irdb") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.irdb は source=irdb のときのみ有効です",
        path: ["filters", "irdb"]
      });
    }
    if (data.filters?.nihu_bridge !== undefined && data.source !== "nihu_bridge") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.nihu_bridge は source=nihu_bridge のときのみ有効です",
        path: ["filters", "nihu_bridge"]
      });
    }
    if (data.filters?.jdcat !== undefined && data.source !== "jdcat") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.jdcat は source=jdcat のときのみ有効です",
        path: ["filters", "jdcat"]
      });
    }
    if (
      data.filters?.ndl !== undefined &&
      data.source !== "ndl_search" &&
      data.source !== "ndl_catalog" &&
      data.source !== "ndl_digital" &&
      data.source !== "ndl_articles" &&
      data.source !== "ndl_articles_online"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "filters.ndl は NDL 系 source のときのみ有効です",
        path: ["filters", "ndl"]
      });
    }
  });

export const recordInputSchema = z.object({
  source: sourceInputFieldSchema,
  source_id: z.string().trim().min(1).describe("source 内のレコードID。jp_lit_search の items[].source_id を指定する。"),
  force_refresh: forceRefreshFieldSchema
});

const externalProviderSchema = z.enum(["crossref", "openalex"]);
const externalProviderStatusSchema = z.enum(["ok", "not_found", "skipped", "error"]);
const matchConfidenceSchema = z.enum(["high", "medium", "low", "none"]);

export const enrichRecordInputToolSchema = z.object({
  doi: z.string().trim().min(1).optional().describe("照合したい DOI。URL 形式や doi: 接頭辞でもよい。指定すると title より DOI 照合を優先する。"),
  title: z.string().trim().min(1).optional().describe("照合したい候補タイトル。DOI が無い人文系文献では title / authors / issued_year の組み合わせで補助照合する。"),
  authors: z.array(z.string().trim().min(1)).default([]).describe("候補の著者名配列。未指定なら空配列として扱う。title-only 照合の confidence 判定に使う。"),
  issued_year: z.string().trim().min(1).optional().describe("候補の刊行年。title-only 照合の confidence 判定に使う。"),
  providers: z.array(externalProviderSchema).min(1).default(["crossref", "openalex"]).describe("照合に使う外部 provider。Crossref は無認証、OpenAlex は OPENALEX_API_KEY が無い場合 skipped になる。"),
  force_refresh: forceRefreshFieldSchema
});

export const enrichRecordInputSchema = enrichRecordInputToolSchema
  .superRefine((data, ctx) => {
    if (!data.doi && !data.title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "doi または title のどちらかを指定してください",
        path: ["doi"]
      });
    }
  });

export const searchOutputSchema = z.object({
  query: z.string(),
  source: sourceSchema.nullable(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(searchItemSchema),
  facets: facetsSchema.optional(),
  cache: z.object({
    hit: z.boolean(),
    cache_key: z.string(),
    saved_at: z.string(),
    refresh_hint: z.string().nullable()
  }).optional()
});

export const recordOutputSchema = recordItemSchema.extend({
  cache: toolCacheSchema.optional()
});

const externalProviderSummarySchema = z.object({
  status: externalProviderStatusSchema,
  item_count: z.number().int().nonnegative(),
  note: z.string().nullable()
});

const enrichRecordQueryOutputSchema = z.object({
  doi: z.string().nullable(),
  title: z.string().nullable(),
  authors: z.array(z.string()),
  issued_year: z.string().nullable()
});

const enrichRecordMatchSchema = z.object({
  provider: externalProviderSchema,
  id: z.string(),
  doi: z.string().nullable(),
  title: z.string(),
  authors: z.array(z.string()),
  issued_year: z.string().nullable(),
  url: z.string().nullable(),
  cited_by_count: z.number().int().nonnegative().nullable(),
  source_title: z.string().nullable(),
  type: z.string().nullable(),
  match_confidence: matchConfidenceSchema,
  reasons: z.array(z.string()),
  missing: z.array(z.string()),
  caution: z.string()
});

export const enrichRecordOutputSchema = z.object({
  query: enrichRecordQueryOutputSchema,
  providers: z.object({
    crossref: externalProviderSummarySchema.optional(),
    openalex: externalProviderSummarySchema.optional()
  }),
  matches: z.array(enrichRecordMatchSchema),
  caution: z.string(),
  cache: toolCacheSchema.optional()
});

export const textCoordinatesInputSchema = z.object({
  source: sourceInputFieldSchema.describe("通常は ndl_digital。source_id を使う場合は jp_lit_get_record で OCR 利用可否を確認してから指定する。"),
  source_id: z.string().trim().min(1).optional().describe("NDL デジタルコレクションの source_id。pid が分かる場合は pid を優先できる。"),
  pid: z.string().trim().min(1).optional().describe("次世代デジタルライブラリーの pid。jp_lit_search_fulltext の結果から直接渡せる。"),
  page: z.number().int().positive().describe("取得するページ番号。1 始まり。"),
  force_refresh: forceRefreshFieldSchema
});

export const textCoordinatesOutputSchema = z.object({
  pid: z.string(),
  page: z.number().int().positive(),
  page_image_url: z.string(),
  contents: z.unknown(),
  coordjson: z.unknown(),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export const fulltextInputSchema = z.object({
  source: sourceInputFieldSchema.describe("通常は ndl_digital。source_id を使う場合は jp_lit_get_record で OCR 利用可否を確認してから指定する。"),
  source_id: z.string().trim().min(1).optional().describe("NDL デジタルコレクションの source_id。pid が分かる場合は pid を優先できる。"),
  pid: z.string().trim().min(1).optional().describe("次世代デジタルライブラリーの pid。jp_lit_search_fulltext の結果から直接渡せる。"),
  force_refresh: forceRefreshFieldSchema
});

export const fulltextOutputSchema = z.object({
  pid: z.string(),
  pages: z.unknown(),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export const searchPagesInputSchema = z.object({
  source: sourceInputFieldSchema.describe("通常は ndl_digital。source_id を使う場合は jp_lit_get_record で OCR 利用可否を確認してから指定する。"),
  source_id: z.string().trim().min(1).optional().describe("NDL デジタルコレクションの source_id。pid が分かる場合は pid を優先できる。"),
  pid: z.string().trim().min(1).optional().describe("次世代デジタルライブラリーの pid。jp_lit_search_fulltext の結果から直接渡せる。"),
  keyword: z.string().trim().min(1).describe("資料内 OCR テキストから探す語。"),
  size: z.number().int().positive().max(100).default(20).describe("返すページ一致の最大件数。最大 100。"),
  from: z.number().int().nonnegative().default(0).describe("検索結果の offset。0 始まり。"),
  force_refresh: forceRefreshFieldSchema
});

export const searchPagesOutputSchema = z.object({
  pid: z.string(),
  keyword: z.string(),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  items: z.unknown(),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export type IrdbFilters = z.infer<typeof irdbFiltersSchema>;
export type NihuBridgeFilters = z.infer<typeof nihuBridgeFiltersSchema>;
export type NihuBridgeInstitute = z.infer<typeof nihuBridgeInstituteSchema>;
export type JdcatFilters = z.infer<typeof jdcatFiltersSchema>;
export type NihuBridgeBbox = z.infer<typeof nihuBridgeBboxSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type RecordInput = z.infer<typeof recordInputSchema>;
export type EnrichRecordInput = z.infer<typeof enrichRecordInputSchema>;
export type SearchOutput = z.infer<typeof searchOutputSchema>;
export type RecordOutput = z.infer<typeof recordOutputSchema>;
export type EnrichRecordOutput = z.infer<typeof enrichRecordOutputSchema>;
export type TextCoordinatesInput = z.infer<typeof textCoordinatesInputSchema>;
export type TextCoordinatesOutput = z.infer<typeof textCoordinatesOutputSchema>;
export type FulltextInput = z.infer<typeof fulltextInputSchema>;
export type FulltextOutput = z.infer<typeof fulltextOutputSchema>;
export type SearchPagesInput = z.infer<typeof searchPagesInputSchema>;
export type SearchPagesOutput = z.infer<typeof searchPagesOutputSchema>;

export const sessionItemLabelSchema = z.enum([
  "confirmed",
  "strong_candidate",
  "weak_candidate"
]);

const sourcePlanInputSchema = z.object({
  source: sourceInputFieldSchema,
  status: z.enum(["planned", "used", "deferred", "skipped"]).describe("source を使う予定・使用済み・保留・除外のどれとして扱うか。"),
  reason: z.string().trim().min(1).describe("その source 選択または除外の理由。"),
  expected_contribution: z.string().trim().min(1).optional().describe("その source が調査に寄与すると期待する内容。")
}).strict();

const searchAttemptSchema = z.object({
  source: sourceSchema.nullable().describe("試行した source。横断検索など特定不能な場合は null。"),
  query: z.string().trim().min(1).describe("実際に試した検索語。"),
  purpose: z.string().trim().min(1).describe("この検索を行った目的。"),
  total: z.number().int().nonnegative().nullable().describe("tool が返した総件数。不明な場合は null。"),
  returned_count: z.number().int().nonnegative().describe("実際に返ってきた件数。"),
  extracted_count: z.number().int().nonnegative().describe("候補として抽出・検討した件数。"),
  outcome: z.enum(["useful", "partial", "empty", "noisy", "failed"]).describe("検索試行の評価。"),
  next_step: z.string().trim().min(1).optional().describe("この検索結果を受けた次の行動。")
}).strict();

function createEvidenceRefSchema() {
  return z.object({
    tool: z.string().trim().min(1).optional().describe("根拠を得た tool 名。例: jp_lit_search。"),
    cache_key: z.string().trim().min(1).optional().describe("根拠を含む保存済み実行結果の cache_key。"),
    source: optionalSourceInputFieldSchema,
    source_id: z.string().trim().min(1).optional().describe("根拠となる source 内レコードID。"),
    url: z.string().trim().min(1).optional().describe("根拠確認に使った公式 URL。"),
    quote_or_summary: z.string().trim().min(1).optional().describe("根拠箇所の短い引用または要約。")
  }).strict();
}

const traceTargetSchema = z.object({
  source: optionalSourceInputFieldSchema,
  source_id: z.string().trim().min(1).optional().describe("対象候補の source 内レコードID。"),
  cache_key: z.string().trim().min(1).optional().describe("対象候補を含む保存済み実行結果の cache_key。"),
  title: z.string().trim().min(1).optional().describe("対象候補のタイトル。")
}).strict();

const evidenceTargetSchema = traceTargetSchema.omit({ cache_key: true }).strict();

const decisionInputSchema = z.object({
  kind: z.enum(["adopt", "hold", "reject", "deduplicate", "needs_followup"]).describe("候補に対する判断種別。"),
  target: traceTargetSchema.describe("判断対象の候補。"),
  reason: z.string().trim().min(1).describe("その判断にした理由。"),
  evidence_refs: z.array(createEvidenceRefSchema()).describe("判断の根拠となる tool 結果や URL。")
}).strict();

const evidenceScopeInputSchema = z.object({
  target: evidenceTargetSchema.describe("確認範囲を記録する対象候補。"),
  checked: z.enum([
    "metadata",
    "abstract",
    "toc",
    "fulltext_snippet",
    "fulltext",
    "external_review"
  ]).describe("確認した根拠の範囲。"),
  body_status: z.enum([
    "not_checked",
    "online_entry_unread",
    "no_online_entry",
    "restricted",
    "confirmed"
  ]).describe("本文・実体確認の状態。"),
  note: z.string().trim().min(1).optional().describe("確認範囲に関する短い補足。"),
  evidence_refs: z.array(createEvidenceRefSchema()).describe("確認範囲の根拠となる tool 結果や URL。")
}).strict();

const entryTraceInputSchema = z.object({
  agent_label: z.string().trim().min(1).optional().describe("この記録を残す agent や作業者の短いラベル。"),
  task_scope: z.string().trim().min(1).optional().describe("この注釈が対象とする作業範囲。"),
  intent: z.string().trim().min(1).optional().describe("この注釈・検索・選別の意図。"),
  search_attempt: searchAttemptSchema.optional().describe("この entry に対応する検索試行の記録。"),
  decisions: z.array(decisionInputSchema).optional().describe("候補採否・重複・保留などの判断記録。"),
  evidence_scope: z.array(evidenceScopeInputSchema).optional().describe("候補ごとにどこまで確認したかの記録。")
}).strict();

const openQuestionInputSchema = z.object({
  question: z.string().trim().min(1).describe("未解決の確認事項。"),
  reason: z.string().trim().min(1).describe("その確認事項が残っている理由。"),
  related_sources: z.array(sourceSchema).optional().describe("関係する source ID の配列。"),
  evidence_refs: z.array(createEvidenceRefSchema()).optional().describe("未解決事項の根拠や関連する tool 結果。")
}).strict();

const nextActionInputSchema = z.object({
  action: z.string().trim().min(1).describe("次に行う具体的な調査アクション。"),
  reason: z.string().trim().min(1).describe("そのアクションが必要な理由。"),
  priority: z.enum(["high", "medium", "low"]).describe("次アクションの優先度。"),
  source: optionalSourceInputFieldSchema,
  evidence_refs: z.array(createEvidenceRefSchema()).optional().describe("次アクションの根拠や関連する tool 結果。")
}).strict();

export const annotateSessionInputSchema = z.object({
  tool: z.string().trim().min(1).describe("注釈対象の結果を生成した tool 名。通常は jp_lit_search または jp_lit_refine_results。"),
  cache_key: cacheKeyInputFieldSchema,
  selected_items: z.array(
    z.object({
      source: sourceInputFieldSchema,
      source_id: z.string().trim().min(1).describe("選別した候補の source 内レコードID。"),
      title: z.string().trim().min(1).describe("選別した候補のタイトル。"),
      label: sessionItemLabelSchema.describe("候補の選別ラベル。confirmed, strong_candidate, weak_candidate のいずれか。"),
      note: z.string().trim().min(1).nullable().describe("候補ごとの短い選別メモ。不要なら null。")
    })
  ).describe("現在の調査セッションに保存する選別済み候補。未選別の検索結果そのものは変更しない。"),
  notes: z.array(z.string().trim().min(1)).optional().describe("この注釈 entry 全体に対する補足メモ。"),
  trace: entryTraceInputSchema.optional().describe("検索意図、判断、根拠確認範囲などの調査経過。")
});

export const annotateSessionOutputSchema = z.object({
  session_id: z.string(),
  updated_at: z.string(),
  annotated_count: z.number().int().nonnegative()
});

export const updateSessionTraceInputSchema = z.object({
  research_goal: z.string().trim().min(1).optional().describe("現在の調査セッション全体の目的。"),
  scope_note: z.string().trim().min(1).optional().describe("調査範囲、除外範囲、確認済み範囲の説明。"),
  source_plans: z.array(sourcePlanInputSchema).optional().describe("source ごとの利用予定・利用済み・保留・除外理由。"),
  open_questions: z.array(openQuestionInputSchema).optional().describe("未解決の確認事項。"),
  next_actions: z.array(nextActionInputSchema).optional().describe("次に取るべき調査アクション。")
}).strict();

export const updateSessionTraceOutputSchema = z.object({
  session_id: z.string(),
  updated_at: z.string(),
  source_plan_count: z.number().int().nonnegative(),
  open_question_count: z.number().int().nonnegative(),
  next_action_count: z.number().int().nonnegative()
});

export const exportSessionInputSchema = z.object({
  session_id: sessionIdInputFieldSchema.optional().describe("書き出す過去セッションID。未指定なら現在の調査セッションを書き出す。"),
  format: z.enum(["markdown", "json", "csl-json"]).default("markdown").describe("出力形式。markdown は人間向け、json は完全な構造化ログ、csl-json は文献管理向け。"),
  profile: z
    .enum(["full_log", "selected", "unselected"])
    .default("full_log")
    .describe("書き出す範囲。full_log は全履歴、selected は選別済み候補、unselected は未選別候補。"),
  output_path: z.string().trim().min(1).optional().describe("出力先ファイルパス。未指定なら repo 内 exports/ に自動生成する。"),
  include_unselected: z.boolean().default(true).describe("markdown/json の full_log で未選別候補を含めるかどうか。")
});

export const exportSessionOutputSchema = z.object({
  session_id: z.string(),
  format: z.enum(["markdown", "json", "csl-json"]),
  profile: z.enum(["full_log", "selected", "unselected"]),
  path: z.string(),
  exported_at: z.string(),
  item_count: z.number().int().nonnegative()
});

export const findSessionsInputSchema = z.object({
  query: z.string().trim().min(1).describe("過去セッションの検索語。主題、候補タイトル、メモ、検索語 preview に部分一致する。"),
  limit: z.number().int().positive().max(50).default(10).describe("返すセッション候補の最大件数。最大 50。")
});

export const findSessionsMatchedFieldSchema = z.enum([
  "query",
  "selected_title",
  "notes"
]);

export const findSessionsOutputSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      session_id: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      matched_fields: z.array(findSessionsMatchedFieldSchema),
      query_preview: z.string().nullable(),
      selected_count: z.number().int().nonnegative(),
      note_preview: z.string().nullable()
    })
  )
});

export const listSessionsInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(20).describe("返すセッション件数。最大 100。"),
  updated_from: z.string().trim().min(1).optional().describe("updated_at の下限 ISO datetime。"),
  updated_to: z.string().trim().min(1).optional().describe("updated_at の上限 ISO datetime。"),
  created_from: z.string().trim().min(1).optional().describe("created_at の下限 ISO datetime。"),
  created_to: z.string().trim().min(1).optional().describe("created_at の上限 ISO datetime。"),
  has_trace: z.boolean().optional().describe("調査目的・source plan・次アクションなど trace を持つセッションだけに絞る。"),
  has_selected: z.boolean().optional().describe("選別済み候補を持つセッションだけに絞る。"),
  source: optionalSourceInputFieldSchema,
  sort_by: z.enum(["updated_at", "created_at"]).default("updated_at").describe("セッション一覧の並び替え項目。"),
  sort_order: z.enum(["desc", "asc"]).default("desc").describe("セッション一覧の並び順。desc は新しい順。")
});

export const listSessionsOutputSchema = z.object({
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  sort_by: z.enum(["updated_at", "created_at"]),
  sort_order: z.enum(["desc", "asc"]),
  filters: z.object({
    updated_from: z.string().nullable(),
    updated_to: z.string().nullable(),
    created_from: z.string().nullable(),
    created_to: z.string().nullable(),
    has_trace: z.boolean().nullable(),
    has_selected: z.boolean().nullable(),
    source: sourceSchema.nullable()
  }),
  items: z.array(
    z.object({
      session_id: z.string(),
      created_at: z.string(),
      updated_at: z.string(),
      research_goal: z.string().nullable(),
      scope_note: z.string().nullable(),
      entry_count: z.number().int().nonnegative(),
      selected_count: z.number().int().nonnegative(),
      source_count: z.number().int().nonnegative(),
      sources: z.array(sourceSchema),
      query_preview: z.string().nullable(),
      selected_title_preview: z.string().nullable(),
      has_trace: z.boolean(),
      has_selected: z.boolean(),
      trace_counts: z.object({
        source_plan_count: z.number().int().nonnegative(),
        open_question_count: z.number().int().nonnegative(),
        next_action_count: z.number().int().nonnegative(),
        decision_count: z.number().int().nonnegative(),
        evidence_scope_count: z.number().int().nonnegative()
      })
    })
  )
});

export const searchCacheIndexInputSchema = z.object({
  query: z.string().trim().min(1).describe("保存済み jp_lit_search 結果内で探す語。元の検索語、タイトル、著者、件名、source_id を NFKC 正規化して部分一致検索する。"),
  session_id: sessionIdInputFieldSchema.optional().describe("このセッションに紐づく jp_lit_search cache だけを検索する。未指定なら全セッションに紐づく cache を対象にする。"),
  source: optionalSourceInputFieldSchema.describe("保存済み検索結果の source を絞る。例: ndl_catalog, cinii_books。未指定なら source を問わない。"),
  issued_from: z.string().optional().describe("結果 item の issued_at 下限。年だけの '1900' など、既存データと同じ文字列表現で比較する。"),
  issued_to: z.string().optional().describe("結果 item の issued_at 上限。issued_from と組み合わせて刊行年範囲を絞る。"),
  saved_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|today|yesterday|last_7_days)$/)
    .optional()
    .describe("cache 保存日の簡易指定。YYYY-MM-DD, today, yesterday, last_7_days のいずれか。"),
  saved_from: z.string().optional().describe("cache saved_at の下限 ISO datetime。saved_on より細かく保存時刻を絞る場合に使う。"),
  saved_to: z.string().optional().describe("cache saved_at の上限 ISO datetime。saved_from と組み合わせて保存時刻を絞る。"),
  limit: z.number().int().positive().max(200).default(50).describe("返す cache entry の最大件数。最大 200。")
});

export const searchCacheIndexOutputSchema = z.object({
  query: z.string(),
  session_id: z.string().nullable(),
  source: sourceSchema.nullable(),
  issued_from: z.string().nullable(),
  issued_to: z.string().nullable(),
  saved_on: z.string().nullable(),
  saved_on_resolved: z.string().nullable(),
  saved_from: z.string().nullable(),
  saved_to: z.string().nullable(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  cache_keys: z.array(z.string()),
  items: z.array(
    z.object({
      cache_key: z.string(),
      session_ids: z.array(z.string()),
      saved_at: z.string(),
      source: sourceSchema.nullable(),
      query_preview: z.string().nullable(),
      total: z.number().int().nonnegative(),
      item_count: z.number().int().nonnegative(),
      matched_fields: z.array(
        z.enum(["query", "title", "author", "subject", "source_id"])
      )
    })
  )
});

export const deleteCacheInputSchema = z
  .object({
    tool: z.string().trim().min(1).default("jp_lit_search").describe("削除対象の tool cache 名。既定は jp_lit_search。"),
    cache_key: cacheKeyInputFieldSchema.optional().describe("削除する個別 cache_key。clear_all=false の場合は必須。"),
    clear_all: z.boolean().default(false).describe("true の場合は指定 tool の cache を全削除する破壊的操作。false の場合は cache_key 単位で削除する。")
  })
  .superRefine((data, ctx) => {
    if (!data.clear_all && !data.cache_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cache_key を指定するか clear_all=true を指定してください",
        path: ["cache_key"]
      });
    }
  });

export const deleteCacheOutputSchema = z.object({
  tool: z.string(),
  cache_key: z.string().nullable(),
  clear_all: z.boolean(),
  deleted_count: z.number().int().nonnegative(),
  deleted: z.boolean(),
  message: z.string()
});

export const pruneCacheInputSchema = z.object({
  older_than_days: z.number().int().positive().default(30).describe("この日数より古い cache を prune 候補にする。"),
  tool: z.string().trim().min(1).optional().describe("対象 tool cache 名。未指定なら全 tool cache を対象にする。"),
  dry_run: z.boolean().default(true).describe("true なら削除せず候補だけ返す。false のときだけ実際に古い cache を削除する。"),
  limit: z.number().int().positive().max(1000).default(100).describe("列挙または削除する候補の最大件数。最大 1000。")
});

export const pruneCacheOutputSchema = z.object({
  dry_run: z.boolean(),
  older_than_days: z.number().int().positive(),
  cutoff_saved_at: z.string(),
  tool: z.string().nullable(),
  limit: z.number().int().positive(),
  matched_count: z.number().int().nonnegative(),
  pruned_count: z.number().int().nonnegative(),
  total_bytes: z.number().int().nonnegative(),
  candidates: z.array(z.object({
    tool: z.string(),
    cache_key: z.string(),
    saved_at: z.string(),
    bytes: z.number().int().nonnegative(),
    root: z.enum(["current", "legacy"])
  })),
  skipped_count: z.number().int().nonnegative(),
  skipped: z.array(z.object({
    path: z.string(),
    reason: z.string()
  })),
  message: z.string()
});

export const listCacheInputSchema = z.object({
  tool: z.string().trim().min(1).optional().describe("一覧対象の tool cache 名。未指定なら全 tool cache を対象にする。"),
  session_id: sessionIdInputFieldSchema.optional().describe("このセッションに紐づく cache だけを一覧する。"),
  saved_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|today|yesterday|last_7_days)$/)
    .optional()
    .describe("cache 保存日の簡易指定。YYYY-MM-DD, today, yesterday, last_7_days のいずれか。"),
  saved_from: z.string().optional().describe("cache saved_at の下限 ISO datetime。"),
  saved_to: z.string().optional().describe("cache saved_at の上限 ISO datetime。"),
  source: optionalSourceInputFieldSchema.describe("保存済み検索結果の source で絞る。source を持たない cache には一致しない。"),
  limit: z.number().int().positive().max(500).default(100).describe("返す cache entry の最大件数。最大 500。")
});

export const listCacheOutputSchema = z.object({
  tool: z.string().nullable(),
  session_id: z.string().nullable(),
  saved_on: z.string().nullable(),
  saved_on_resolved: z.string().nullable(),
  saved_from: z.string().nullable(),
  saved_to: z.string().nullable(),
  source: sourceSchema.nullable(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  cache_keys: z.array(z.string()),
  summary: z.object({
    by_tool: z.record(z.string(), z.number()),
    by_source: z.record(z.string(), z.number()),
    newest_saved_at: z.string().nullable(),
    oldest_saved_at: z.string().nullable()
  }),
  items: z.array(
    z.object({
      tool: z.string(),
      cache_key: z.string(),
      saved_at: z.string(),
      source: sourceSchema.nullable(),
      session_ids: z.array(z.string()),
      query_preview: z.string().nullable(),
      total: z.number().int().nonnegative(),
      item_count: z.number().int().nonnegative()
    })
  )
});

const refineResultsFiltersSchema = z.object({
  source: optionalSourceInputFieldSchema,
  issued_from: z.string().optional().describe("結果 item の issued_at 下限。"),
  issued_to: z.string().optional().describe("結果 item の issued_at 上限。"),
  online: z.boolean().optional().describe("availability.online が指定値と一致する item に絞る。"),
  digital_collection: z.boolean().optional().describe("availability.digital_collection が指定値と一致する item に絞る。"),
  title_contains: z.string().trim().min(1).optional().describe("タイトルに含まれる語で部分一致 filter する。"),
  author_contains: z.string().trim().min(1).optional().describe("著者名に含まれる語で部分一致 filter する。")
});

const duplicateClusterReasonSchema = z.enum([
  "shared_duplicate_key",
  "title_author_year_match",
  "title_author_match",
  "year_match",
  "publisher_match",
  "multi_source",
  "same_source_variant"
]);

const searchResultReadinessSchema = z.object({
  level: z.enum(["strong", "medium", "weak"]),
  reasons: z.array(z.string()),
  missing: z.array(z.string())
});

const duplicateClusterSchema = z.object({
  cluster_id: z.string(),
  duplicate_confidence: z.enum(["strong", "medium", "weak"]),
  member_count: z.number().int().positive(),
  representative: searchItemSchema,
  members_preview: z.array(searchItemSchema),
  omitted_member_count: z.number().int().nonnegative(),
  reasons: z.array(duplicateClusterReasonSchema),
  search_result_readiness: searchResultReadinessSchema,
  caution: z.string()
});

const duplicateClusterSummarySchema = z.object({
  total_items_considered: z.number().int().nonnegative(),
  cluster_count: z.number().int().nonnegative(),
  singleton_count: z.number().int().nonnegative(),
  strong_cluster_count: z.number().int().nonnegative(),
  medium_cluster_count: z.number().int().nonnegative(),
  weak_cluster_count: z.number().int().nonnegative(),
  returned_cluster_count: z.number().int().nonnegative(),
  cluster_limit: z.number().int().positive(),
  cluster_offset: z.number().int().nonnegative()
});

export const refineResultsInputSchema = z.object({
  cache_key: cacheKeyInputFieldSchema.optional().describe("再抽出する単一の jp_lit_search cache_key。cache_keys と同時指定しない。"),
  cache_keys: z.array(cacheKeyInputFieldSchema).min(1).optional().describe("集合演算する複数の jp_lit_search cache_key。"),
  session_id: sessionIdInputFieldSchema.optional().describe("セッションに紐づく検索 cache を対象にする場合のセッションID。"),
  combine: z.enum(["union", "intersection", "minus"]).default("union").describe("複数 cache の集合演算。union は和集合、intersection は積集合、minus は先頭から後続を除外する。"),
  key_by: z
    .enum(["source_record", "duplicate_key", "title_author_year"])
    .default("source_record")
    .describe("集合演算時に item を同一視するキー。source_record は source+source_id、duplicate_key は正規化重複キー、title_author_year はタイトル著者年。"),
  sort_by: z.enum(["issued_at", "title"]).optional().describe("再抽出結果の並び替え項目。未指定なら元の順序を保つ。"),
  sort_order: z.enum(["asc", "desc"]).default("asc").describe("sort_by 指定時の並び順。"),
  limit: z.number().int().positive().max(200).default(30).describe("返す item の最大件数。最大 200。"),
  offset: z.number().int().nonnegative().default(0).describe("返す item の offset。0 始まり。"),
  include_duplicate_clusters: z.boolean().default(false).describe("true の場合は重複候補クラスタを追加で返す。"),
  cluster_limit: z.number().int().positive().default(20).describe("返す重複クラスタの最大件数。"),
  cluster_offset: z.number().int().nonnegative().default(0).describe("重複クラスタ一覧の offset。0 始まり。"),
  cluster_member_limit: z.number().int().positive().default(5).describe("各重複クラスタで preview する member の最大件数。"),
  filters: refineResultsFiltersSchema.optional().describe("保存済み結果に対するローカル filter。upstream 再検索は行わない。")
});

export const refineResultsOutputSchema = z.object({
  base_cache_key: z.string(),
  base_cache_keys: z.array(z.string()),
  combine: z.enum(["union", "intersection", "minus"]),
  key_by: z.enum(["source_record", "duplicate_key", "title_author_year"]),
  totals_by_base: z.array(
    z.object({
      cache_key: z.string(),
      total: z.number().int().nonnegative()
    })
  ),
  total_before: z.number().int().nonnegative(),
  total_after: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  items: z.array(searchItemSchema),
  cluster_summary: duplicateClusterSummarySchema.optional(),
  clusters: z.array(duplicateClusterSchema).optional()
});

export const exportViewInputSchema = z.discriminatedUnion("view", [
  z.object({
    view: z.literal("cache_list").describe("書き出すビュー種別。cache_list は jp_lit_list_cache 相当の一覧。"),
    params: listCacheInputSchema.default({}).describe("cache_list に渡す filter と pagination。"),
    format: z.enum(["markdown", "json"]).default("markdown").describe("出力形式。markdown は人間向け、json は構造化データ。"),
    output_path: z.string().trim().min(1).optional().describe("出力先ファイルパス。未指定なら repo 内 exports/ に自動生成する。")
  }),
  z.object({
    view: z.literal("cache_query").describe("書き出すビュー種別。cache_query は jp_lit_search_cache_index 相当の横断検索結果。"),
    params: searchCacheIndexInputSchema.describe("cache_query に渡す検索条件。"),
    format: z.enum(["markdown", "json"]).default("markdown").describe("出力形式。markdown は人間向け、json は構造化データ。"),
    output_path: z.string().trim().min(1).optional().describe("出力先ファイルパス。未指定なら repo 内 exports/ に自動生成する。")
  }),
  z.object({
    view: z.literal("refined_results").describe("書き出すビュー種別。refined_results は jp_lit_refine_results 相当の再抽出結果。"),
    params: refineResultsInputSchema.default({}).describe("refined_results に渡す再抽出条件。"),
    format: z.enum(["markdown", "json"]).default("markdown").describe("出力形式。markdown は人間向け、json は構造化データ。"),
    export_all: z.boolean().default(false).describe("true の場合は limit/offset を超えて対象結果を全件 export する。"),
    duplicate_notes: z.boolean().default(false).describe("true の場合は重複候補クラスタの確認ノートを出力に含める。"),
    output_path: z.string().trim().min(1).optional().describe("出力先ファイルパス。未指定なら repo 内 exports/ に自動生成する。")
  })
]);

export const exportViewOutputSchema = z.object({
  view: z.enum(["cache_list", "cache_query", "refined_results"]),
  format: z.enum(["markdown", "json"]),
  path: z.string(),
  exported_at: z.string(),
  item_count: z.number().int().nonnegative()
});

const fulltextBookItemSchema = z.object({
  pid: z.string(),
  viewer_url: z.string(),
  title: z.string().nullable(),
  volume: z.string().nullable(),
  responsibility: z.string().nullable(),
  publisher: z.string().nullable(),
  published: z.string().nullable(),
  publishyear: z.number().int().nullable(),
  ndc: z.string().nullable(),
  bib_id: z.string().nullable(),
  call_no: z.string().nullable(),
  page_count: z.number().int().nullable(),
  is_classic: z.boolean().nullable(),
  highlights: z.unknown()
});

export const searchFulltextInputSchema = z.object({
  keyword: z.string().trim().min(1).describe("NDL デジタルコレクション公開範囲の OCR / メタデータから探す語。"),
  searchfield: z.enum(["contentonly", "metaonly", "all"]).default("contentonly").describe("検索対象。contentonly は本文 OCR、metaonly はメタデータ、all は両方。"),
  size: z.number().int().positive().max(100).default(20).describe("返す資料候補の最大件数。最大 100。"),
  from: z.number().int().nonnegative().default(0).describe("検索結果の offset。0 始まり。"),
  f_ndc: z.string().optional().describe("NDL デジタルコレクションの NDC filter。分かっている場合だけ指定する。"),
  fc_is_classic: z.boolean().optional().describe("古典籍フラグで絞る場合に指定する。"),
  force_refresh: forceRefreshFieldSchema
});

export const searchFulltextOutputSchema = z.object({
  keyword: z.string(),
  searchfield: z.enum(["contentonly", "metaonly", "all"]),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  items: z.array(fulltextBookItemSchema),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export type SearchFulltextInput = z.infer<typeof searchFulltextInputSchema>;
export type SearchFulltextOutput = z.infer<typeof searchFulltextOutputSchema>;

const illustrationItemSchema = z.object({
  id: z.string(),
  pid: z.string(),
  viewer_url: z.string(),
  page: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  graphictags: z.array(z.object({
    tagname: z.string(),
    confidence: z.number()
  })),
  page_image_url: z.string(),
  illustration_image_url: z.string()
});

export const searchIllustrationsInputSchema = z.object({
  keyword: z.string().trim().min(1).describe("NDL デジタルコレクション公開範囲の図版タグ・周辺テキストから探す語。"),
  size: z.number().int().positive().max(100).default(20).describe("返す図版候補の最大件数。最大 100。"),
  from: z.number().int().nonnegative().default(0).describe("検索結果の offset。0 始まり。"),
  force_refresh: forceRefreshFieldSchema
});

export const searchIllustrationsOutputSchema = z.object({
  keyword: z.string(),
  total: z.number().int().nonnegative(),
  from: z.number().int().nonnegative(),
  items: z.array(illustrationItemSchema),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export const searchKokushoFulltextInputSchema = z.object({
  keyword: z.string().trim().min(1).describe("国書データベースの翻刻/OCR スニペットまたは画像タグから探す語。"),
  limit: z.number().int().positive().max(100).default(20).describe("返す候補の最大件数。最大 100。"),
  page: z.number().int().positive().default(1).describe("検索結果ページ番号。1 始まり。"),
  force_refresh: forceRefreshFieldSchema
});

const kokushoPersonSchema = z.object({
  name: z.string(),
  role: z.string().nullable()
});

const searchKokushoFulltextItemSchema = z.object({
  bid: z.string(),
  source_id: z.string(),
  title: z.string().nullable(),
  work_title: z.string().nullable(),
  authors: z.array(kokushoPersonSchema),
  koma: z.number().int().positive().nullable(),
  line: z.number().int().positive().nullable(),
  snippet: z.string().nullable(),
  viewer_url: z.string(),
  biblio_url: z.string(),
  source_metadata: z.record(z.unknown())
});

export const searchKokushoFulltextOutputSchema = z.object({
  keyword: z.string(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(searchKokushoFulltextItemSchema),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export const searchKokushoImageTagsInputSchema = searchKokushoFulltextInputSchema;

const searchKokushoImageTagItemSchema = z.object({
  bid: z.string(),
  source_id: z.string(),
  title: z.string().nullable(),
  work_title: z.string().nullable(),
  authors: z.array(kokushoPersonSchema),
  koma: z.number().int().positive().nullable(),
  tag_texts: z.array(z.string()),
  image_paths: z.array(z.string()),
  viewer_url: z.string(),
  biblio_url: z.string(),
  source_metadata: z.record(z.unknown())
});

export const searchKokushoImageTagsOutputSchema = z.object({
  keyword: z.string(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(searchKokushoImageTagItemSchema),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

const crdLibGroupSchema = z.enum([
  "public",
  "univ",
  "special",
  "school",
  "archive",
  "ndl",
  "other"
]);

const guidesSearchInputBaseSchema = z.object({
  query: z.string().trim().min(1).describe("レファレンス協同データベースから探す調べ方・事例の検索語。"),
  limit: z.number().int().positive().max(20).default(10).describe("返す事例・マニュアルの最大件数。最大 20。"),
  page: z.number().int().positive().default(1).describe("検索結果ページ番号。1 始まり。"),
  lib_id: z.string().trim().min(1).optional().describe("特定図書館の CRD library ID に絞る場合に指定する。"),
  lib_group: crdLibGroupSchema.optional().describe("公共図書館、大学図書館、専門図書館などの館種で絞る。"),
  force_refresh: forceRefreshFieldSchema
});

const guidesBaseItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string().nullable(),
  url: z.string(),
  published_at: z.string().nullable(),
  categories: z.array(z.string()),
  summary: z.string().nullable(),
  description: z.string()
});

export const guidesManualsInputSchema = guidesSearchInputBaseSchema;
export const guidesCasesInputSchema = guidesSearchInputBaseSchema;

export const guidesManualItemSchema = guidesBaseItemSchema.extend({
  search_keywords: z.array(z.string()),
  guide_headings: z.array(z.string())
});

export const guidesCaseItemSchema = guidesBaseItemSchema.extend({
  question: z.string().nullable(),
  answer_process: z.string().nullable(),
  preliminary_research: z.string().nullable(),
  reference_sources: z.array(z.string())
});

export const guidesManualsOutputSchema = z.object({
  query: z.string(),
  type: z.literal("manual"),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(guidesManualItemSchema),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

export const guidesCasesOutputSchema = z.object({
  query: z.string(),
  type: z.literal("reference"),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(guidesCaseItemSchema),
  raw: z.record(z.unknown()),
  cache: toolCacheSchema.optional()
});

const authorityTypeSchema = z.enum([
  "person",
  "corporate",
  "subject",
  "uniform_title",
  "genre",
  "unknown"
]);

const resolveAuthorityTypeSchema = z.enum([
  "person",
  "corporate",
  "subject",
  "uniform_title",
  "genre",
  "all"
]);

const authorityRelationSchema = z.enum([
  "pseudonym",
  "former_name",
  "real_name",
  "related_name",
  "unknown"
]);

export const resolveAuthorityInputSchema = z.object({
  query: z.string().trim().min(1).describe("確認したい人名・団体名・件名・統一タイトルなどの典拠検索語。"),
  type: resolveAuthorityTypeSchema.default("all").describe("探す典拠種別。all は人名・団体名・件名などを横断する。"),
  limit: z.number().int().positive().max(20).default(5).describe("返す典拠候補の最大件数。最大 20。"),
  force_refresh: forceRefreshFieldSchema
});

const authorityLinkedNameSchema = z.object({
  label: z.string(),
  authority_uri: z.string().nullable(),
  relation: authorityRelationSchema,
  relation_label: z.string().nullable()
});

const authorityLinkedTermSchema = z.object({
  label: z.string(),
  authority_uri: z.string().nullable()
});

const authorityItemSchema = z.object({
  authority_uri: z.string(),
  id: z.string().nullable(),
  type: authorityTypeSchema,
  label: z.string(),
  label_reading: z.string().nullable(),
  label_romanized: z.string().nullable(),
  variant_labels: z.array(z.string()),
  same_identity_names: z.array(authorityLinkedNameSchema),
  broader_terms: z.array(authorityLinkedTermSchema),
  narrower_terms: z.array(authorityLinkedTermSchema),
  related_terms: z.array(authorityLinkedTermSchema),
  source_metadata: z.record(z.unknown())
});

export const resolveAuthorityOutputSchema = z.object({
  query: z.string(),
  type: resolveAuthorityTypeSchema,
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  items: z.array(authorityItemSchema),
  search_hints: z.object({
    preferred_terms: z.array(z.string()),
    variant_terms: z.array(z.string()),
    same_identity_terms: z.array(z.string()),
    reference_terms: z.array(z.string()),
    caution: z.string()
  }),
  cache: toolCacheSchema.optional()
});

export const authorityClassificationSchemeSchema = z.enum(["NDC10", "NDC9", "NDC8", "NDC6"]);

export const authorityTermsByClassificationInputSchema = z.object({
  classification: z.string().trim().min(1).describe("NDC などの分類記号。例: 910.26。"),
  scheme: authorityClassificationSchemeSchema.default("NDC10").describe("分類体系。既定は NDC10。"),
  limit: z.number().int().positive().max(50).default(20).describe("返す件名標目候補の最大件数。最大 50。"),
  force_refresh: forceRefreshFieldSchema
});

export const authorityTermsByClassificationOutputSchema = z.object({
  classification: z.object({
    scheme: authorityClassificationSchemeSchema,
    notation: z.string()
  }),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  items: z.array(authorityItemSchema),
  search_hints: z.object({
    preferred_terms: z.array(z.string()),
    reference_terms: z.array(z.string()),
    caution: z.string()
  }),
  cache: toolCacheSchema.optional()
});

export const searchKakenProjectsInputSchema = z.object({
  query: z.string().trim().min(1).describe("KAKEN から探す研究課題名・キーワード・研究テーマ。"),
  limit: z.number().int().positive().max(20).default(10).describe("返す研究課題候補の最大件数。最大 20。"),
  page: z.number().int().positive().default(1).describe("検索結果ページ番号。1 始まり。"),
  detail_limit: z.number().int().nonnegative().max(10).default(5).describe("詳細ページを追加取得する候補数。0 なら詳細取得しない。最大 10。"),
  researcher_name: z.string().trim().min(1).optional().describe("研究代表者・研究分担者名で絞る場合に指定する。"),
  from_fiscal_year: z.number().int().optional().describe("研究期間の開始年度下限。"),
  to_fiscal_year: z.number().int().optional().describe("研究期間の終了年度上限。"),
  include_outputs: z.boolean().default(true).describe("true の場合は成果リスト preview も取得する。文献確定は CiNii / J-STAGE / IRDB / NDL で再確認する。"),
  force_refresh: forceRefreshFieldSchema
});

const kakenOutputTypeSchema = z.enum([
  "journal_article",
  "book",
  "conference_presentation",
  "report",
  "other"
]);

const kakenProjectSchema = z.object({
  project_id: z.string(),
  title: z.string(),
  url: z.string(),
  principal_investigator: z.object({
    name: z.string(),
    affiliation: z.string().nullable(),
    researcher_number: z.string().nullable()
  }).nullable(),
  fiscal_years: z.string().nullable(),
  project_type: z.string().nullable(),
  fields: z.array(z.string()),
  keywords: z.array(z.string()),
  summary: z.string().nullable(),
  detail_fetched: z.boolean(),
  detail_omitted_reason: z.enum([
    "detail_limit_exceeded",
    "include_outputs_false",
    "fetch_failed"
  ]).nullable(),
  report_pdf_status: z.enum(["found", "none_found", "not_checked", "fetch_failed"]),
  report_pdfs: z.array(z.object({
    label: z.string(),
    fiscal_year: z.string().nullable(),
    url: z.string()
  })),
  outputs_preview: z.array(z.object({
    type: kakenOutputTypeSchema,
    raw_type: z.string().nullable(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.string().nullable(),
    doi: z.string().nullable(),
    url: z.string().nullable(),
    note: z.string().nullable()
  })),
  search_hints: z.object({
    project_terms: z.array(z.string()),
    researcher_terms: z.array(z.string()),
    keyword_terms: z.array(z.string()),
    caution: z.string()
  })
});

export const searchKakenProjectsOutputSchema = z.object({
  query: z.string(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(kakenProjectSchema),
  cache: toolCacheSchema.optional()
});

export type SearchIllustrationsInput = z.infer<typeof searchIllustrationsInputSchema>;
export type SearchIllustrationsOutput = z.infer<typeof searchIllustrationsOutputSchema>;
export type SearchKokushoFulltextInput = z.infer<typeof searchKokushoFulltextInputSchema>;
export type SearchKokushoFulltextOutput = z.infer<typeof searchKokushoFulltextOutputSchema>;
export type SearchKokushoImageTagsInput = z.infer<typeof searchKokushoImageTagsInputSchema>;
export type SearchKokushoImageTagsOutput = z.infer<typeof searchKokushoImageTagsOutputSchema>;
export type GuidesManualsInput = z.infer<typeof guidesManualsInputSchema>;
export type GuidesManualsOutput = z.infer<typeof guidesManualsOutputSchema>;
export type GuidesCasesInput = z.infer<typeof guidesCasesInputSchema>;
export type GuidesCasesOutput = z.infer<typeof guidesCasesOutputSchema>;
export type ResolveAuthorityInput = z.infer<typeof resolveAuthorityInputSchema>;
export type ResolveAuthorityOutput = z.infer<typeof resolveAuthorityOutputSchema>;
export type AuthorityTermsByClassificationInput = z.infer<typeof authorityTermsByClassificationInputSchema>;
export type AuthorityTermsByClassificationOutput = z.infer<typeof authorityTermsByClassificationOutputSchema>;
export type AnnotateSessionInput = z.infer<typeof annotateSessionInputSchema>;
export type AnnotateSessionOutput = z.infer<typeof annotateSessionOutputSchema>;
export type UpdateSessionTraceInput = z.infer<typeof updateSessionTraceInputSchema>;
export type UpdateSessionTraceOutput = z.infer<typeof updateSessionTraceOutputSchema>;
export type ExportSessionInput = z.infer<typeof exportSessionInputSchema>;
export type ExportSessionOutput = z.infer<typeof exportSessionOutputSchema>;
export type ExportViewInput = z.infer<typeof exportViewInputSchema>;
export type ExportViewOutput = z.infer<typeof exportViewOutputSchema>;
export type FindSessionsInput = z.infer<typeof findSessionsInputSchema>;
export type FindSessionsOutput = z.infer<typeof findSessionsOutputSchema>;
export type ListSessionsInput = z.infer<typeof listSessionsInputSchema>;
export type ListSessionsOutput = z.infer<typeof listSessionsOutputSchema>;
export type SearchCacheIndexInput = z.infer<typeof searchCacheIndexInputSchema>;
export type SearchCacheIndexOutput = z.infer<typeof searchCacheIndexOutputSchema>;
export type DeleteCacheInput = z.infer<typeof deleteCacheInputSchema>;
export type DeleteCacheOutput = z.infer<typeof deleteCacheOutputSchema>;
export type PruneCacheInput = z.infer<typeof pruneCacheInputSchema>;
export type PruneCacheOutput = z.infer<typeof pruneCacheOutputSchema>;
export type ListCacheInput = z.infer<typeof listCacheInputSchema>;
export type ListCacheOutput = z.infer<typeof listCacheOutputSchema>;
export type RefineResultsInput = z.infer<typeof refineResultsInputSchema>;
export type RefineResultsOutput = z.infer<typeof refineResultsOutputSchema>;
export type SearchKakenProjectsInput = z.infer<typeof searchKakenProjectsInputSchema>;
export type SearchKakenProjectsOutput = z.infer<typeof searchKakenProjectsOutputSchema>;
