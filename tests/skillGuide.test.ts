import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { exportViewInputSchema } from "../src/lib/schemas.js";
import {
  extractJsonToolCall,
  findForbiddenBrowserClaims
} from "./helpers/browserDocumentContracts.js";

describe("jp-lit-research skill guide", () => {
  it("routes reference-book research from guides to detail and holdings confirmation", () => {
    const sourceAndQuery = readFileSync(
      "skills/jp-lit-research/reference/02-source-and-query.md",
      "utf8"
    );

    const guideIndex = sourceAndQuery.search(/レファ協|リサーチ・ナビ/);
    const sourceIndex = sourceAndQuery.indexOf("ndl_reference_books");
    const routing = sourceAndQuery.slice(sourceIndex, sourceIndex + 1200);
    const detailIndex = routing.search(/jp_lit_get_record(?:s)?/);
    const holdingsIndex = routing.search(/cinii_books|カーリル|OPAC/);

    expect(sourceAndQuery).toMatch(/参考図書|レファ本|事典|辞典|書誌|索引|年鑑/);
    expect(guideIndex).toBeGreaterThanOrEqual(0);
    expect(sourceIndex).toBeGreaterThan(guideIndex);
    expect(detailIndex).toBeGreaterThan(0);
    expect(holdingsIndex).toBeGreaterThan(detailIndex);
  });

  it("keeps SKILL.md as a lightweight router with mandatory output contracts", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");

    const lineCount = skill.split(/\r?\n/).length;
    expect(lineCount).toBeLessThanOrEqual(200);

    expect(skill).toContain("## 起動条件");
    expect(skill).toContain("## 必ず守る");
    expect(skill).toContain("## 最小ワークフロー");
    expect(skill).toContain("## intent 分類");
    expect(skill).toContain("## 参照ファイル");
    expect(skill).toContain("## 標準出力テンプレート");
    expect(skill).toContain("## 最終回答前チェック");

    expect(skill).toContain("文献DBで調べて");
    expect(skill).toContain("一度発火したらセッション中は継続");
    expect(skill).toContain("検索前に短い調査方針");
    expect(skill).toContain("継続指示");
    expect(skill).toContain("調査ログ");
    expect(skill).toContain("jp_lit_update_session_trace");
    expect(skill).toContain("担当範囲");
    expect(skill).toContain("| # | source | query | total | 取得件数 | 抽出件数 | 備考 |");
    expect(skill).toContain("availability.online=true");
    expect(skill).toContain("本文: オンライン入口あり未読");
    expect(skill).toContain("本文: 確認済み");
    expect(skill).toContain("今回の確認範囲");
    expect(skill).toContain("Web は補助確認");
    expect(skill).toContain(
      "実検索前にレファ協・NDL リサーチ・ナビを参考にして調査計画を立てる"
    );
    expect(skill).toContain(
      "原則として、レファ協・NDL リサーチ・ナビを参考に調査前情報収集を行う"
    );
  });

  it("routes detailed workflow, source, evidence, and cache guidance to references", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    expect(skill).toContain("reference/01-core-workflow.md");
    expect(skill).toContain("reference/02-source-and-query.md");
    expect(skill).toContain("reference/03-evidence-and-output.md");
    expect(skill).toContain("heuristics/source-selection.md");
    expect(skill).toContain("heuristics/query-expansion.md");
    expect(skill).toContain("heuristics/evidence-grading.md");
    expect(skill).toContain("heuristics/failure-modes.md");
    expect(skill).toContain("workflows/");

    const workflowCore = readFileSync(
      "skills/jp-lit-research/reference/01-core-workflow.md",
      "utf8"
    );
    const sourceAndQuery = readFileSync(
      "skills/jp-lit-research/reference/02-source-and-query.md",
      "utf8"
    );
    const advisory = readFileSync(
      "skills/jp-lit-research/heuristics/advisory-consultation.md",
      "utf8"
    );
    const evidence = readFileSync(
      "skills/jp-lit-research/reference/03-evidence-and-output.md",
      "utf8"
    );
    const grading = readFileSync(
      "skills/jp-lit-research/heuristics/evidence-grading.md",
      "utf8"
    );
    const sourceSelection = readFileSync(
      "skills/jp-lit-research/heuristics/source-selection.md",
      "utf8"
    );
    const failureModes = readFileSync(
      "skills/jp-lit-research/heuristics/failure-modes.md",
      "utf8"
    );
    const workflow = readFileSync(
      "skills/jp-lit-research/workflows/topic-literature-review.md",
      "utf8"
    );
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");

    expect(workflowCore).toContain("対話的な探索ループ");
    expect(workflowCore).toContain("cache_key");
    expect(workflowCore).toContain("session_id");
    expect(skill).toContain("Mcp-Session-Id");
    expect(skill).toContain("cache_key");
    expect(workflowCore).toContain("同じ `session_id`");
    expect(workflowCore).toContain("jp_lit_start_session");
    expect(workflowCore).toContain("jp_lit_update_session_trace");
    expect(workflowCore).toContain("single writer");
    expect(workflowCore).toContain("サブエージェント分担をデフォルト寄りに検討");
    expect(workflowCore).toContain("調査トレース報告");
    expect(workflowCore).toContain("brief summary ではなく");
    expect(workflowCore).toContain("jp_lit_refine_results");
    expect(workflowCore).toContain("Web は主経路にしない");
    expect(workflowCore).toContain("ユーザーが Web 調査を明示");
    expect(sourceAndQuery).toContain("jp_lit_search_guides_manuals");
    expect(sourceAndQuery).toContain("jp_lit_search_guides_cases");
    expect(sourceAndQuery).toContain("jp_lit_suggest_classification_codes");
    expect(sourceAndQuery).toContain("filters.cinii.category");
    expect(sourceAndQuery).toContain("全N件中M件取得");
    expect(sourceAndQuery).toContain("source 未指定の横断検索は `page=1` のみ対応");
    expect(advisory).toContain("リサーチ・ナビが参考書誌");
    expect(advisory).toContain("参考書誌・索引・契約 DB");
    expect(advisory).toContain("reference_tools");
    expect(advisory).toContain("要有料DB確認");
    expect(sourceSelection).toContain("参考書誌・索引・有料DBでの追加確認");
    expect(evidence).toContain("本文: オンライン入口あり未読");
    expect(evidence).toContain("availability.online=true");
    expect(evidence).toContain("highlights");
    expect(evidence).toContain("table_of_contents");
    expect(evidence).toContain("selected_items.note");
    expect(evidence).toContain("search_attempt");
    expect(evidence).toContain("evidence_scope");
    expect(evidence).toContain("CSL JSON には trace を混ぜない");
    expect(evidence).toContain("自費出版・個人出版支援・オンデマンド出版");
    expect(evidence).toContain("主題一致だけで `優先: 高` にしない");
    expect(evidence).toContain("対象文献そのものと専門的書評・批判・応答をセットで探す");
    expect(evidence).toContain("学会誌・研究会誌・紀要・専門誌の書評");
    expect(evidence).toContain("Web補助確認");
    expect(evidence).toContain("文献DB由来の書誌・要旨・目次と混同しない");
    expect(evidence).toContain("出版社・団体の性格");
    expect(evidence).toContain("検索全体の選別理由");
    expect(evidence).toContain("次: 発信者プロフィール確認");
    expect(evidence).toContain("長い注意書きは毎件付けない");
    expect(sourceSelection).toContain("要有料DB確認");
    expect(sourceSelection).toContain("ざっさくプラス");
    expect(sourceSelection).toContain("大宅壮一文庫");
    expect(sourceSelection).toContain("毎回の定型注意にはしない");
    expect(failureModes).toContain("有料DB用の検索語");
    expect(failureModes).toContain("参考書誌・索引・一般誌");
    expect(grading).toContain("内容把握の確からしさ");
    expect(grading).toContain("出版社・媒体・シリーズだけで文献の価値を確定しない");
    expect(grading).toContain("自費出版・個人出版支援・オンデマンド出版");
    expect(grading).toContain("主題一致だけで高優先にしない");
    expect(grading).toContain("学会誌・研究会誌・紀要・専門誌の書評");
    expect(grading).toContain("対象文献そのものと専門的書評・批判・応答");
    expect(grading).toContain("Web由来情報は補助確認");
    expect(usageGuide).toContain("自費出版、個人出版支援、オンデマンド出版");
    expect(usageGuide).toContain("主題に一致するだけで `優先: 高` にはせず");
    expect(usageGuide).toContain("学会誌・研究会誌・紀要・専門誌の署名書評");
    expect(usageGuide).toContain("Web は主経路ではなく補助確認");
    expect(usageGuide).toContain("`根拠: Web補助確認`");
    expect(usageGuide).toContain(
      "未知の文献・資料・調べ方を探索する調査の場合、検索前に原則として"
    );
    expect(usageGuide).toContain("0 件・ノイズ過多・初出/掲載号/一般誌記事探索");
    expect(usageGuide).toContain("リサーチ・ナビ、レファ協を入口候補として計画します");
    expect(usageGuide).toContain(
      "リサーチ・ナビの曖昧検索は API / MCP source ではなく"
    );
    expect(usageGuide).toContain("isFuzzy=true");
    expect(workflow).toContain("本文未読の内容別・論点別分類");
    expect(workflow).toContain("優先");
  });

  it("separates candidate certainty from body confirmation labels", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const evidence = readFileSync(
      "skills/jp-lit-research/reference/03-evidence-and-output.md",
      "utf8"
    );
    const grading = readFileSync(
      "skills/jp-lit-research/heuristics/evidence-grading.md",
      "utf8"
    );
    const topicWorkflow = readFileSync(
      "skills/jp-lit-research/workflows/topic-literature-review.md",
      "utf8"
    );
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const combinedResearchDocs = `${skill}\n${evidence}\n${grading}\n${topicWorkflow}\n${usageGuide}`;

    expect(skill).toContain(
      "単独の `確認済み` を文献リストの主要ラベルとして使わない"
    );
    expect(skill).toContain("検索ヒットのみ / 関連性未確定");
    expect(evidence).toContain("候補確度: 書誌確認済み");
    expect(evidence).toContain("候補確度: 関連性未確定");
    expect(evidence).toContain("確認: 検索ヒットのみ");
    expect(evidence).toContain("本文: オンライン入口あり未読");
    expect(grading).toContain("## 候補確度（書誌・関連性）");
    expect(grading).toContain("### 書誌確認済み（Bibliographically confirmed）");
    expect(topicWorkflow).toContain("▍候補確度: 書誌確認済み");
    expect(usageGuide).toContain("候補確度: 書誌確認済み");
    expect(combinedResearchDocs).not.toContain("▍確認済み文献");
    expect(combinedResearchDocs).not.toContain("### ✅ 確認済み");
    expect(combinedResearchDocs).not.toContain(
      "| **確認済み** | 書誌情報・本文・ページ画像などで内容を確認できたもの"
    );
  });

  it("documents Next Digital Library compound query limits", () => {
    const fulltextWorkflow = readFileSync(
      "skills/jp-lit-research/workflows/fulltext-page-lookup.md",
      "utf8"
    );
    const queryExpansion = readFileSync(
      "skills/jp-lit-research/heuristics/query-expansion.md",
      "utf8"
    );
    const failureModes = readFileSync(
      "skills/jp-lit-research/heuristics/failure-modes.md",
      "utf8"
    );

    expect(fulltextWorkflow).toContain(
      "`jp_lit_search_fulltext` では空白 AND や `AND` 演算子を上流仕様として期待しない"
    );
    expect(fulltextWorkflow).toContain(
      "複合語 0 件を、両語が同一資料に存在しない証拠として扱わない"
    );
    expect(fulltextWorkflow).toContain(
      "`jp_lit_search_pages` は既知 PID 内の補助確認として使う"
    );
    expect(queryExpansion).toContain(
      "デジコレ OCR では、複合検索語より単語単位の検索語展開を優先する"
    );
    expect(queryExpansion).toContain("jp_lit_suggest_classification_codes");
    expect(queryExpansion).toContain("jp_lit_find_authority_terms_by_classification");
    expect(failureModes).toContain("複合語 0 件を不在証明にしない");
    expect(failureModes).toContain("単独語検索と複合語検索を分けて調査ログに残す");
    expect(fulltextWorkflow).toContain(
      "実例: `キューリン` 単独では hit=25、`キューリン 博士` は hit=0"
    );
  });

  it("requires explicit browser permission for Digital Collections coverage", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const workflow = readFileSync(
      "skills/jp-lit-research/workflows/fulltext-page-lookup.md",
      "utf8"
    );
    const failureModes = readFileSync(
      "skills/jp-lit-research/heuristics/failure-modes.md",
      "utf8"
    );
    const imageWorkflow = readFileSync(
      "skills/jp-lit-research/workflows/image-illustration-search.md",
      "utf8"
    );
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const reference = readFileSync("docs/reference.md", "utf8");
    expect(skill).toContain(
      "デジコレ公式画面のブラウザ操作は既定では行わない"
    );
    expect(skill).toContain("未ログイン検索");
    expect(skill).toContain("ログイン済み Chrome");
    expect(skill).toContain("別の権限");
    expect(skill).toContain("無断で切り替えない");
    expect(skill).toContain("MCP の検索件数で決めない");
    expect(workflow).toContain("MCP の検索件数にかかわらず");
    expect(workflow).toContain("既定は MCP のみ");
    expect(workflow).toContain("ログイン済み Chrome は別の権限");
    expect(workflow).toContain("公開・文書化 API");
    expect(workflow).toContain("全件収集");
    expect(workflow).toContain("検索と閲覧");
    expect(workflow).toContain("人間が認証した事実だけでは");
    expect(workflow).toContain("本文: アクセス制限");
    expect(workflow).not.toContain("インターネット公開済み、available 確認不要");
    expect(imageWorkflow).not.toContain("デジコレ全資料");
    expect(failureModes).toContain("0 件の場合だけ");
    expect(failureModes).toContain("MCP の検索件数にかかわらず");
    expect(readme).toContain("ブラウザ操作は明示的に許可");
    expect(usageGuide).toContain("未ログイン検索のみ");
    expect(usageGuide).toContain("ログイン済み Chrome も使用可");
    expect(reference).toContain("公開・文書化 API");
    expect(reference).toContain("安定した全件収集");
  });

  it("normalizes authorized NDL browser observations into one candidate workflow", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const workflow = readFileSync(
      "skills/jp-lit-research/workflows/fulltext-page-lookup.md",
      "utf8"
    );
    const workflowCore = readFileSync(
      "skills/jp-lit-research/reference/01-core-workflow.md",
      "utf8"
    );
    const evidence = readFileSync(
      "skills/jp-lit-research/reference/03-evidence-and-output.md",
      "utf8"
    );
    const skillAndReferences = `${skill}\n${workflow}\n${workflowCore}\n${evidence}`;

    for (const required of [
      "jp_lit_record_ndl_browser_search",
      "result_refs",
      "logged_in_existing_session",
      "page_image_checked",
      "print_file_state",
      "デジコレ本体の全文検索",
      "次世代デジタルライブラリー",
      "館内限定",
      "検索ヒット",
      "資料詳細",
      "一つの候補リスト",
      "発見経路",
      "access",
      "content",
      "fulltext",
      "print"
    ]) {
      expect.soft(skillAndReferences, required).toContain(required);
    }

    const normalizedWorkflow = workflow.slice(
      workflow.indexOf("## デジコレ公式画面の候補統合")
    );
    const orderedSteps = [
      "jp_lit_search_fulltext",
      "ユーザーが許可した",
      "jp_lit_record_ndl_browser_search",
      "jp_lit_refine_results",
      "jp_lit_annotate_session",
      "jp_lit_export_session"
    ];
    let previousIndex = -1;
    for (const step of orderedSteps) {
      const stepIndex = normalizedWorkflow.indexOf(step);
      expect.soft(stepIndex, step).toBeGreaterThan(previousIndex);
      previousIndex = stepIndex;
    }

    expect(skillAndReferences).toContain("ログイン済みタブがあるから見て");
    expect(skillAndReferences).toContain("再確認しない");
    expect(skillAndReferences).toContain("MCP 本体はブラウザ・ログイン・外部通信を行わない");
    expect(skillAndReferences).toContain("認証情報を入力しない");
    expect(skillAndReferences).toContain("cookie を受け取らない");
    expect(skillAndReferences).toContain("CAPTCHA を回避しない");
    expect(skillAndReferences).toContain("アクセス制限を回避しない");
    expect(skillAndReferences).toContain("未ログインでも");
    expect(skillAndReferences).toContain("個人送信");
    expect(skillAndReferences).toContain("既存ログイン済み session");
    expect(skillAndReferences).toContain("`ndl_onsite_only`");
    expect(skillAndReferences).toContain("ログインしても遠隔閲覧できない");

    for (const state of [
      "logged_out",
      "not_checked",
      "unavailable",
      "available",
      "searched",
      "restricted",
      "viewer_available",
      "dialog_available",
      "generation_requested",
      "pdf_ready",
      "saved"
    ]) {
      expect.soft(skillAndReferences, state).toContain(state);
    }
    expect(skillAndReferences).not.toMatch(
      /jp_lit_search_fulltext[^\n]{0,80}デジコレ全資料/
    );
  });

  it("provides an executable refined-results export example without collapsing browser states", () => {
    const workflow = readFileSync(
      "skills/jp-lit-research/workflows/fulltext-page-lookup.md",
      "utf8"
    );
    const call = extractJsonToolCall(workflow, "jp_lit_export_view");

    expect(call.tool).toBe("jp_lit_export_view");
    const result = exportViewInputSchema.safeParse(call.arguments);
    expect(result.success, result.success ? "" : result.error.message).toBe(true);

    const exportExample = JSON.stringify(call.arguments);
    const orderedFields = ["refined_results", "params", "result_refs"];
    let previous = -1;
    for (const field of orderedFields) {
      const index = exportExample.indexOf(field);
      expect.soft(index, field).toBeGreaterThan(previous);
      previous = index;
    }

    expect(findForbiddenBrowserClaims(workflow)).toEqual([]);
  });

  it("documents rolling checkpoints and environment-neutral delegation contracts", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const workflowCore = readFileSync(
      "skills/jp-lit-research/reference/01-core-workflow.md",
      "utf8"
    );
    const evidence = readFileSync(
      "skills/jp-lit-research/reference/03-evidence-and-output.md",
      "utf8"
    );
    const sourceSelection = readFileSync(
      "skills/jp-lit-research/heuristics/source-selection.md",
      "utf8"
    );
    const combined = `${skill}\n${workflowCore}\n${evidence}\n${sourceSelection}`;

    expect(skill).toContain("rolling checkpoint");
    expect(workflowCore).toContain("## 長期調査の rolling checkpoint");
    expect(evidence).toContain("## rolling checkpoint");
    expect(evidence).toContain("検索ヒットのみ候補");
    expect(evidence).toContain("cache key / session id / 関連ファイル");
    expect(evidence).toContain("## サブエージェント分担契約");
    expect(evidence).toContain("環境固有の呼び出し API に依存しない");
    expect(sourceSelection).toContain("戦前デジコレ OCR 担当");
    expect(sourceSelection).toContain("J-STAGE / CiNii 現代研究担当");
    expect(combined).toContain("主エージェントが統合判断を持ち続ける");
  });

  it("requires subagent handoff reports instead of brief summaries", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const workflowCore = readFileSync(
      "skills/jp-lit-research/reference/01-core-workflow.md",
      "utf8"
    );
    const evidence = readFileSync(
      "skills/jp-lit-research/reference/03-evidence-and-output.md",
      "utf8"
    );
    const combined = `${skill}\n${workflowCore}\n${evidence}`;

    expect(combined).not.toContain("短いサマリー");
    expect(skill).toContain("調査トレース報告");
    expect(skill).toContain("cache は検索結果・取得 payload の保管場所");
    expect(skill).toContain("サブエージェント使用時は handoff report");
    expect(workflowCore).toContain("current report");
    expect(workflowCore).toContain("変更履歴");
    expect(evidence).toContain("## 調査トレース報告");
    expect(evidence).toContain("jp_lit_export_session(session_id=");

    for (const required of [
      "担当範囲",
      "session_id",
      "cache_key",
      "使用 source",
      "検索語",
      "件数の読み方",
      "主な検索試行",
      "採用候補",
      "保留候補",
      "除外理由",
      "本文確認範囲",
      "根拠参照",
      "未確認事項",
      "主エージェントへの判断ポイント",
      "変更履歴",
    ]) {
      expect(evidence).toContain(required);
    }

    expect(evidence).toContain("total は検索元が返した総ヒット数");
    expect(evidence).toContain("取得件数は実際に取得して読めた件数");
    expect(evidence).toContain(
      "抽出件数は主要候補・保留候補・除外代表などへ選別した件数"
    );
  });

  it("documents cache, session trace, final answer, and handoff report roles", () => {
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const combinedDocs = `${readme}\n${usageGuide}`;

    expect(combinedDocs).not.toContain("短いサマリー");
    expect(usageGuide).toContain("### 調査後に残るもの");
    expect(usageGuide).toContain("cache");
    expect(usageGuide).toContain("session trace");
    expect(usageGuide).toContain("最終回答");
    expect(usageGuide).toContain("調査トレース報告 / handoff report");
    expect(usageGuide).toContain("session trace は復元用");
    expect(usageGuide).toContain("handoff report は判断用");
    expect(usageGuide).toContain("サブエージェント使用時は必須");
    expect(usageGuide).toContain("単独エージェント時は必要に応じて作成");
    expect(readme).toContain("調査成果物");
    expect(readme).toContain("cache / session trace / handoff report");
  });

  it("uses CRD and Research Navi before searches to build the research plan", () => {
    const workflowCore = readFileSync(
      "skills/jp-lit-research/reference/01-core-workflow.md",
      "utf8"
    );
    const advisory = readFileSync(
      "skills/jp-lit-research/heuristics/advisory-consultation.md",
      "utf8"
    );
    const failureModes = readFileSync(
      "skills/jp-lit-research/heuristics/failure-modes.md",
      "utf8"
    );
    const workflowTopic = readFileSync(
      "skills/jp-lit-research/workflows/topic-literature-review.md",
      "utf8"
    );
    const workflowResearchGuide = readFileSync(
      "skills/jp-lit-research/workflows/research-guide-lookup.md",
      "utf8"
    );
    const workflowBibliography = readFileSync(
      "skills/jp-lit-research/workflows/bibliography-lookup.md",
      "utf8"
    );
    const workflowHistoricalTerm = readFileSync(
      "skills/jp-lit-research/workflows/historical-term-search.md",
      "utf8"
    );
    const workflowImageIllustration = readFileSync(
      "skills/jp-lit-research/workflows/image-illustration-search.md",
      "utf8"
    );
    const clarifyingQuestions = readFileSync(
      "skills/jp-lit-research/heuristics/clarifying-questions.md",
      "utf8"
    );

    expect(workflowCore).toContain(
      "調査を始める前に、まずレファ協と NDL リサーチ・ナビを参考にして調査計画を立てる"
    );
    expect(workflowCore).toContain(
      "単純な所蔵確認・書誌確認だけを行う場合は省略してよい"
    );
    expect(advisory).toContain(
      "未知の文献・資料・調べ方を探索する調査では、実検索の前に原則としてこの手順を使う"
    );
    expect(advisory).toContain("| `topic_literature_review` | 実行 |");
    expect(advisory).toContain("| `historical_term_search` | 実行 |");
    expect(workflowTopic).toContain(
      "テーマ文献探索では、原則としてレファ協とリサーチ・ナビを検索計画の材料にする"
    );
    expect(workflowTopic).toContain(
      "人名単独、回想記事、雑誌目次、一般誌記事、初出、掲載号探索"
    );
    expect(advisory).toContain(
      "人名単独、回想記事、雑誌目次、一般誌記事、初出、掲載号探索、0 件・ノイズ過多の再計画では省略しない"
    );
    expect(advisory).toContain(
      "曖昧検索は API / MCP source として扱わず、リサーチ・ナビ画面での再検索リンクとして使う"
    );
    expect(advisory).toContain("isFuzzy=true");
    expect(workflowResearchGuide).toContain("リサーチ・ナビ曖昧検索リンク");
    expect(failureModes).toContain(
      "難航時にレファ協・リサーチ・ナビで、別の資料類型・索引・調査順序を確認したか"
    );
    expect(failureModes).toContain("jp_lit_search_guides_manuals");
    expect(failureModes).toContain("雑誌の総目次・バックナンバー");
    expect(workflowTopic).toContain("reference_tools");
    expect(workflowBibliography).toContain("調査前情報収集の要否");
    expect(workflowBibliography).toContain("単純な所蔵確認・書誌確認だけを行う場合");
    expect(workflowBibliography).toContain("初出、掲載号、雑誌記事、一般誌記事を探す");
    expect(workflowHistoricalTerm).toContain(
      "近代以前・旧字・別称・初出調査が絡む場合は、実検索前に"
    );
    expect(workflowHistoricalTerm).toContain("advisory-consultation を省略しない");
    expect(workflowImageIllustration).toContain(
      "美術・文化財・博物館資料・地域資料が絡む場合は、実検索前に"
    );
    expect(clarifyingQuestions).toContain(
      "未知の文献・資料・調べ方を探索する調査では、レファ協・NDL リサーチ・ナビを参考にした計画を示す"
    );
    expect(clarifyingQuestions).toContain(
      "単純な所蔵確認として、ndl_catalog で「○○」を確認します"
    );
  });

  it("keeps initial searches explicit and avoids source-unspecified round-robin by default", () => {
    const sourceSelection = readFileSync(
      "skills/jp-lit-research/heuristics/source-selection.md",
      "utf8"
    );
    const sourceAndQuery = readFileSync(
      "skills/jp-lit-research/reference/02-source-and-query.md",
      "utf8"
    );
    const workflowResearchGuide = readFileSync(
      "skills/jp-lit-research/workflows/research-guide-lookup.md",
      "utf8"
    );
    const workflowTopic = readFileSync(
      "skills/jp-lit-research/workflows/topic-literature-review.md",
      "utf8"
    );

    expect(sourceSelection).toContain(
      "レファ協・NDL リサーチ・ナビを参考に調査計画を立てた後、実検索の初動では、原則として `source` 未指定のラウンドロビン検索を使わない"
    );
    expect(sourceSelection).toContain(
      "レファ協・リサーチ・ナビで示唆された source 候補を加えて、初手の実検索 source を 2〜4 個に絞る"
    );
    expect(sourceSelection).toContain(
      "`ndl_search` / `japan_search` は専門 DB を押しのける固定順序ではない"
    );
    expect(sourceSelection).toContain(
      "`ndl_search` + `japan_search` を基礎候補にし、調査前情報収集で示唆された専門 DB / source と並べて計画する"
    );
    expect(sourceAndQuery).toContain(
      "新規テーマでは、レファ協・NDL リサーチ・ナビを参考に調査計画を立ててから実検索へ進む"
    );
    expect(sourceAndQuery).toContain(
      "実検索では、原則として `source` 未指定の `jp_lit_search(query=...)` から始めない"
    );
    expect(sourceAndQuery).toContain(
      "レファ協・リサーチ・ナビで示唆された source 候補と組み合わせ、初手は 2〜4 source に絞る"
    );
    expect(sourceAndQuery).toContain(
      "リサーチ・ナビやレファ協が示す専門 DB は、当該分野では基礎候補より有効な入口になりうる"
    );

    for (const doc of [sourceSelection, sourceAndQuery]) {
      expect(doc).toContain("ndl_search");
      expect(doc).toContain("japan_search");
    }

    expect(sourceAndQuery).toContain(
      "`source` 未指定の既定横断は `japan_search` と `ndl_search` を含まない"
    );
    expect(sourceSelection).toContain("人物回想・雑誌目次・一般誌記事");
    expect(workflowTopic).toContain("`ndl_search` と `japan_search` を基礎候補");
    expect(workflowTopic).toContain("レファ協・リサーチ・ナビで示唆された専門 DB / source");
    expect(workflowResearchGuide).toContain(
      "ndl_search / japan_search を基礎候補にし、調べ方案内で示唆された専門 DB / source を加えて 2〜4 個に絞る"
    );

    expect(workflowResearchGuide).not.toContain(
      "jp_lit_search で NDL・CiNii・J-STAGE を横断"
    );
    expect(sourceSelection).not.toContain("NDL + CiNii + J-STAGE の既定構成");
  });

  it("routes specialist DB wording to explicit sources without expanding fixed-source scope", () => {
    const sourceSelection = readFileSync(
      "skills/jp-lit-research/heuristics/source-selection.md",
      "utf8"
    );
    const dbCharacteristics = readFileSync(
      "skills/jp-lit-research/heuristics/db-characteristics.md",
      "utf8"
    );
    const sourceAndQuery = readFileSync(
      "skills/jp-lit-research/reference/02-source-and-query.md",
      "utf8"
    );

    for (const doc of [sourceSelection, dbCharacteristics, sourceAndQuery]) {
      expect(doc).toContain("nijl_articles");
      expect(doc).toContain("kokusho");
      expect(doc).toContain("ninjal_bibliography");
    }

    expect(sourceSelection).toContain("国文学論文");
    expect(sourceSelection).toContain("国書・古典籍");
    expect(sourceSelection).toContain("日本語研究・日本語教育文献");
    expect(sourceAndQuery).toContain("日本文学論文: `nijl_articles`");
    expect(sourceAndQuery).toContain("古典籍・国書・写本・版本: `kokusho`");
    expect(sourceAndQuery).toContain("jp_lit_search_kokusho_fulltext");
    expect(sourceAndQuery).toContain("jp_lit_search_kokusho_image_tags");
    expect(sourceAndQuery).toContain("日本語研究・日本語教育文献・国語教育文献: `ninjal_bibliography`");
    expect(sourceAndQuery).toContain("jp_lit_find_authority_terms_by_classification");
    expect(dbCharacteristics).toContain("本文スニペットは `jp_lit_search_kokusho_fulltext`");
    expect(dbCharacteristics).toContain("画像タグは `jp_lit_search_kokusho_image_tags`");
    expect(sourceSelection).toContain("有料 DB、文化資源 DB、地域アーカイブ DB は固定 source 化しない");
  });

  it("routes regional public library research through local-materials guidance and Calil MCP", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const sourceSelection = readFileSync(
      "skills/jp-lit-research/heuristics/source-selection.md",
      "utf8"
    );
    const sourceAndQuery = readFileSync(
      "skills/jp-lit-research/reference/02-source-and-query.md",
      "utf8"
    );
    const regionalDoc = readFileSync(
      "docs/regional-public-library-research.md",
      "utf8"
    );
    const regionalSkillReference = readFileSync(
      "skills/jp-lit-research/reference/regional-public-library-research.md",
      "utf8"
    );

    expect(skill).toContain("reference/regional-public-library-research.md");
    expect(sourceSelection).toContain("地域資料サービス");
    expect(sourceSelection).toContain("地方公共図書館ルート");
    expect(sourceSelection).toContain("カーリル図書館MCP");
    expect(sourceSelection).toContain("search_libraries");
    expect(sourceSelection).toContain("search_books");
    expect(sourceSelection).toContain("REST API は ISBN 既知の所蔵確認");
    expect(sourceSelection).toContain("Cursor / Claude Code / Codex");
    expect(sourceSelection).toContain("MCP / OAuth 設定を直し");
    expect(sourceAndQuery).toContain("地方人物・地方紙・地方雑誌・郷土資料");
    expect(sourceAndQuery).toContain("`search_libraries` で地域名・館種・ネットワーク名");
    expect(sourceAndQuery).toContain("Web 検索はパスファインダー");
    expect(sourceAndQuery).toContain("記事名ではなく媒体名・巻号");
    expect(sourceAndQuery).toContain("県立図書館を基準点として外さない");
    expect(sourceAndQuery).toContain("該当都道府県立図書館");
    expect(sourceAndQuery).toContain("発行地・活動地に対応する中央館");
    expect(sourceAndQuery).toContain("隣接自治体や旧郡域の館");

    expect(regionalDoc).toContain("地域資料サービス");
    expect(regionalDoc).toContain("郷土資料");
    expect(regionalDoc).toContain("公共図書館パスファインダーリンク集");
    expect(regionalDoc).toContain("カーリル図書館MCP");
    expect(regionalDoc).toContain("Remote MCP");
    expect(regionalDoc).toContain("最大15館");
    expect(regionalDoc).toContain("REST API はキーワード蔵書検索に使わない");
    expect(regionalDoc).toContain("人物名だけでなく地名・媒体名・団体名・発行地");
    expect(regionalDoc).toContain("地方紙・地方雑誌は記事名より媒体名");
    expect(regionalDoc).toContain("県立図書館は地域資料の基準点として外さない");
    expect(regionalDoc).toContain("該当都道府県立図書館");
    expect(regionalDoc).toContain("発行地・活動地に対応する中央館");
    expect(regionalDoc).toContain("隣接自治体や旧郡域の館");
    expect(regionalDoc).toContain("大学図書館および専門図書館のサポートを追加");
    expect(regionalDoc).toContain("SPECIAL");
    expect(regionalDoc).toContain("専門図書館・資料室");
    expect(regionalDoc).toContain("直結できることを確認済み");
    expect(regionalDoc).toContain("localhost");
    expect(regionalDoc).toContain("カーリル MCP 用の `search_libraries` / `search_books` 計画");
    expect(regionalDoc).toContain("地域パスファインダー、各館 OPAC");
    expect(regionalSkillReference).toContain("地域資料サービス");
    expect(regionalSkillReference).toContain("カーリル図書館MCP");
    expect(regionalSkillReference).toContain("Remote MCP");
    expect(regionalSkillReference).toContain("最大15館");
    expect(regionalSkillReference).toContain("REST API はキーワード蔵書検索に使わない");
    expect(regionalSkillReference).toContain("県立図書館は地域資料の基準点として外さない");
    expect(regionalSkillReference).toContain("該当都道府県立図書館");
    expect(regionalSkillReference).toContain("発行地・活動地に対応する中央館");
    expect(regionalSkillReference).toContain("隣接自治体や旧郡域の館");
    expect(regionalSkillReference).toContain("専門図書館・資料室");
    expect(regionalSkillReference).toContain("Cursor / Claude Code / Codex");
    expect(regionalSkillReference).toContain("カーリル MCP 用の `search_libraries` / `search_books` 計画");
    expect(regionalSkillReference).toContain("MCP / OAuth 設定を直し");
    expect(skill).toContain("scripts/plan-regional-library-search.mjs");
    expect(skill).toContain("search_libraries");
    expect(regionalSkillReference).toContain(
      "scripts/plan-regional-library-search.mjs"
    );
    expect(
      existsSync("skills/jp-lit-research/scripts/plan-regional-library-search.mjs")
    ).toBe(true);
  });

  it("details selected NDL Digital candidates before OCR or browser decisions", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const workflow = readFileSync(
      "skills/jp-lit-research/workflows/fulltext-page-lookup.md",
      "utf8"
    );
    const combined = `${skill}\n${workflow}`;

    expect(skill).toContain("選別済みの `ndl_digital` 候補");
    expect(combined).toContain("1件なら `jp_lit_get_record`");
    expect(combined).toContain("2〜10件なら `jp_lit_get_records`");
    expect(combined).toContain("`pids` は1〜10件を受け付ける");
    expect(workflow).toContain("生の検索結果全件を自動詳細化しない");
    expect(workflow).toContain(
      "10件を超える場合は絞り込み、または理由を説明できる小さな chunk"
    );
    expect(workflow).toContain(
      "`content_access.manual_viewing.access_type` と `source_metadata.next_digital_library.available` は独立して読む"
    );
    expect(workflow).toContain(
      "`available=false` だけでアクセス制限の原因を断定しない"
    );
    expect(workflow).toContain("ブラウザ利用許可を意味しない");
  });

  it("routes ephemeral Web discoveries through the existing Web evidence lane", () => {
    const skill = readFileSync("skills/jp-lit-research/SKILL.md", "utf8");
    const runbookPath =
      "skills/jp-lit-research/reference/04-ephemeral-web-discovery.md";

    if (!existsSync(runbookPath)) {
      expect(existsSync(runbookPath)).toBe(true);
      return;
    }

    const runbook = readFileSync(runbookPath, "utf8");

    expect(skill).toContain("reference/04-ephemeral-web-discovery.md");
    expect(skill).toContain("既存Web補助確認の速報Web分岐");
    expect(runbook).toContain("`agent_web`");
    expect(runbook).toContain("`ephemeral`");
    for (const field of [
      "投稿URL",
      "投稿日時",
      "投稿者",
      "検索語",
      "確認日時",
      "リンク先"
    ]) {
      expect(runbook).toContain(field);
    }
    for (const verificationSource of ["出版社", "雑誌", "NDL", "CiNii"]) {
      expect(runbook).toContain(verificationSource);
    }
    expect(runbook).toContain("書誌的事実・真偽・学術的評価の確証にしない");
    expect(runbook).toContain("新しいMCPツール");
    expect(runbook).toContain("Yahoo専用adapter");
    expect(runbook).toContain("スクレイピング");
    expect(runbook).toContain("継続監視");
  });

  it("documents the batch record detail contract in public guides", () => {
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const reference = readFileSync("docs/reference.md", "utf8");
    const projectStatus = readFileSync("docs/project-status.md", "utf8");

    expect(readme).toContain("jp_lit_get_records");
    expect(readme).toContain("同じ source の1〜10件");
    expect(readme).toContain("`pids` は1〜10件を受け付けます");
    expect(usageGuide).toContain("2〜10件なら");
    expect(usageGuide).toContain("`pids` は1〜10件を受け付けます");
    expect(usageGuide).toContain("ブラウザは起動しない");
    expect(reference).toContain("同じ source の1〜10件");
    expect(reference).toContain("重複除去後の入力順");
    expect(reference).toContain("部分成功");
    expect(reference).toContain("items.length = unique_count");
    expect(reference).toContain(
      "success_count + error_count = unique_count"
    );
    expect(projectStatus).toContain("`pids` は1〜10件を受け付ける");
    for (const category of [
      "not_found",
      "invalid_request",
      "timeout",
      "http",
      "invalid_payload",
      "unknown"
    ]) {
      expect(reference).toContain(`\`${category}\``);
    }
    expect(reference).toContain("固定 concurrency 2");
    expect(reference).toContain(
      "各 ID を trim し、重複は最初の出現だけを処理"
    );
    expect(reference).toContain(
      "`force_refresh=true` は重複除去後の全一意 ID に適用"
    );
    expect(reference).toContain("上流の一括 API ではありません");
    expect(reference).toContain(
      "cache miss または `force_refresh=true` の一意 ID ごとに"
    );
    expect(reference).toContain(
      "batch の cache miss は単件取得と同じ上流への個別照会経路を使い"
    );
    expect(reference).not.toContain("batch は外部 source の API だけを使い");
    expect(reference).toContain("独立した cache namespace を持ちません");
    expect(reference).toContain(
      "各成功 item は `jp_lit_get_record` の cache key と session entry を使います"
    );
    expect(reference).toContain(
      "batch 全体を表す cache key や session entry は作成しません"
    );
    expect(reference).toContain("`content_access.manual_viewing`");
    expect(reference).toContain(
      "`source_metadata.next_digital_library.available`"
    );
    expect(reference).toContain("独立して確認してください");
    expect(projectStatus).toContain("公開ツール 30 種");
    expect(projectStatus).toContain("fresh `npm test`");
  });
});
