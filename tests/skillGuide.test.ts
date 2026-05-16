import { existsSync, readFileSync } from "node:fs";
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
    expect(workflowCore).toContain("jp_lit_update_session_trace");
    expect(workflowCore).toContain("single writer");
    expect(workflowCore).toContain("サブエージェント分担をデフォルト寄りに検討");
    expect(workflowCore).toContain("短いサマリーと根拠参照");
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
    expect(usageGuide).toContain(
      "未知の文献・資料・調べ方を探索する調査の場合、検索前に原則として"
    );
    expect(usageGuide).toContain("0 件・ノイズ過多・初出/掲載号/一般誌記事探索");
    expect(usageGuide).toContain("リサーチ・ナビ、レファ協を入口候補として計画します");
    expect(workflow).toContain("本文未読の内容別・論点別分類");
    expect(workflow).toContain("優先");
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
    expect(sourceSelection).toContain("カーリル Remote MCP");
    expect(sourceSelection).toContain("search_libraries");
    expect(sourceSelection).toContain("search_books");
    expect(sourceSelection).toContain("REST API は ISBN 既知の所蔵確認");
    expect(sourceSelection).toContain("Cursor / Claude Code");
    expect(sourceSelection).toContain("clientEnvironment: \"codex\"");
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
    expect(regionalDoc).toContain("カーリル for AI");
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
    expect(regionalDoc).toContain("ChatGPT + カーリルAI");
    expect(regionalDoc).toContain("chatGptCalilPrompt");
    expect(regionalSkillReference).toContain("地域資料サービス");
    expect(regionalSkillReference).toContain("カーリル for AI");
    expect(regionalSkillReference).toContain("Remote MCP");
    expect(regionalSkillReference).toContain("最大15館");
    expect(regionalSkillReference).toContain("REST API はキーワード蔵書検索に使わない");
    expect(regionalSkillReference).toContain("県立図書館は地域資料の基準点として外さない");
    expect(regionalSkillReference).toContain("該当都道府県立図書館");
    expect(regionalSkillReference).toContain("発行地・活動地に対応する中央館");
    expect(regionalSkillReference).toContain("隣接自治体や旧郡域の館");
    expect(regionalSkillReference).toContain("専門図書館・資料室");
    expect(regionalSkillReference).toContain("Cursor / Claude Code");
    expect(regionalSkillReference).toContain("ChatGPT + カーリルAI");
    expect(regionalSkillReference).toContain("chatGptCalilPrompt");
    expect(skill).toContain("scripts/plan-regional-library-search.mjs");
    expect(skill).toContain("clientEnvironment: \"codex\"");
    expect(regionalSkillReference).toContain(
      "scripts/plan-regional-library-search.mjs"
    );
    expect(
      existsSync("skills/jp-lit-research/scripts/plan-regional-library-search.mjs")
    ).toBe(true);
  });
});
