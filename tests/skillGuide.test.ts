import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("jp-lit-research skill guide", () => {
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
    expect(workflowCore).toContain("jp_lit_update_session_trace");
    expect(workflowCore).toContain("single writer");
    expect(workflowCore).toContain("sequential");
    expect(workflowCore).toContain("jp_lit_refine_results");
    expect(workflowCore).toContain("Web は主経路にしない");
    expect(workflowCore).toContain("ユーザーが Web 調査を明示");
    expect(sourceAndQuery).toContain("jp_lit_search_guides_manuals");
    expect(sourceAndQuery).toContain("jp_lit_search_guides_cases");
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
    expect(workflow).toContain("本文未読の内容別・論点別分類");
    expect(workflow).toContain("優先");
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
    expect(dbCharacteristics).toContain("本文スニペットは `jp_lit_search_kokusho_fulltext`");
    expect(dbCharacteristics).toContain("画像タグは `jp_lit_search_kokusho_image_tags`");
    expect(sourceSelection).toContain("有料 DB、文化資源 DB、地域アーカイブ DB は固定 source 化しない");
  });
});
