import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  annotateSessionInputSchema,
  exportSessionInputSchema,
  recordNdlBrowserSearchInputSchema,
  refineResultsInputSchema,
  sourceSchema
} from "../src/lib/schemas.js";
import {
  extractJsonToolCall,
  lintForbiddenBrowserContractClaims
} from "./helpers/browserDocumentContracts.js";

function extractCapabilityTable(markdown: string) {
  const header = "| 経路 | 全文候補検索 | 送信資料ヒット | 本文画像確認 | PDF状態 | cache/session統合 |";
  const start = markdown.indexOf(header);
  if (start < 0) {
    throw new Error("NDL browser capability table not found");
  }

  const rows: string[] = [];
  for (const line of markdown.slice(start).split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      break;
    }
    rows.push(line);
  }
  return rows;
}

function githubHeadingSlugs(markdown: string) {
  const counts = new Map<string, number>();
  const slugs = new Set<string>();

  for (const match of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/[`*~]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }

  return slugs;
}

describe("browser document contract helpers", () => {
  it.each([
    ["mcp_performs_browser_operations", "MCP はブラウザ操作を行う。"],
    ["search_hit_means_body_confirmed", "検索ヒットなら本文を確認したとみなす。"],
    ["dialog_means_pdf_saved", "dialog_available は PDF を保存したことを意味する。"],
    ["onsite_login_allows_remote_access", "ndl_onsite_only はログインすればリモートで閲覧できる。"],
    [
      "mcp_performs_browser_operations",
      "MCP 本体はブラウザ操作を行うが、ログイン操作は行わない。"
    ],
    [
      "onsite_login_allows_remote_access",
      "ndl_onsite_only はログインすれば遠隔閲覧できるが、未ログインではできない。"
    ]
  ] as const)("detects the reviewed forbidden %s variant", (relation, text) => {
    expect(lintForbiddenBrowserContractClaims(text)).toEqual([
      expect.objectContaining({ relation })
    ]);
  });

  it("does not flag the reviewed MCP predicate negation", () => {
    expect(
      lintForbiddenBrowserContractClaims("MCP はブラウザ操作を行うわけではない。")
    ).toEqual([]);
  });

  it("does not let a different predicate negation cancel a forbidden claim", () => {
    const text =
      "MCP はブラウザ操作を行うものとし、ログイン操作は担当しない。";

    expect(lintForbiddenBrowserContractClaims(text)).toEqual([
      expect.objectContaining({ relation: "mcp_performs_browser_operations" })
    ]);
  });

  it.each([
    ["mcp_performs_browser_operations", "MCP 本体がブラウザ操作を行う。"],
    ["mcp_performs_browser_operations", "ブラウザ操作は MCP 本体が担当する。"],
    ["search_hit_means_body_confirmed", "検索ヒットを本文確認済みとして扱う。"],
    ["search_hit_means_body_confirmed", "本文確認済みは検索ヒットを意味する。"],
    ["dialog_means_pdf_saved", "dialog_available ならPDF保存済み。"],
    ["dialog_means_pdf_saved", "PDF保存済みは dialog_available を意味する。"],
    ["onsite_login_allows_remote_access", "ndl_onsite_only はログイン済みなら遠隔可。"],
    ["onsite_login_allows_remote_access", "ログインすれば遠隔閲覧できるのが ndl_onsite_only です。"]
  ] as const)("detects forbidden %s claims independently of word order", (relation, text) => {
    expect(lintForbiddenBrowserContractClaims(text)).toEqual([
      expect.objectContaining({ relation })
    ]);
  });

  it.each([
    "MCP 本体はブラウザ操作を行わない。",
    "検索ヒットを本文確認済みとして扱わない。",
    "dialog_available は PDF 保存済みを意味しない。",
    "ndl_onsite_only はログインしても遠隔閲覧できない。"
  ])("does not flag an explicit negative contract: %s", (text) => {
    expect(lintForbiddenBrowserContractClaims(text)).toEqual([]);
  });

  it("selects a minified JSON tool wrapper by parsed.tool", () => {
    const markdown = [
      "```json",
      '{"tool":"jp_lit_refine_results","arguments":{"session_id":"2026-09-05-120000-a1b2c3d4"}}',
      "```"
    ].join("\n");

    expect(extractJsonToolCall(markdown, "jp_lit_refine_results")).toEqual({
      tool: "jp_lit_refine_results",
      arguments: { session_id: "2026-09-05-120000-a1b2c3d4" }
    });
  });

  it("parses every JSON fence before selecting a tool wrapper", () => {
    const markdown = [
      "```json",
      '{"tool":"broken","arguments":}',
      "```",
      "```json",
      '{"tool": "jp_lit_refine_results", "arguments": {}}',
      "```"
    ].join("\n");

    expect(() => extractJsonToolCall(markdown, "jp_lit_refine_results")).toThrow(
      "Invalid JSON fence 1"
    );
  });
});

describe("README public onboarding", () => {
  it("links to install guides", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("docs/install/codex-app.md");
    expect(readme).toContain("docs/install/codex-cli.md");
    expect(readme).toContain("docs/install/cursor.md");
    expect(readme).toContain("docs/install/claude-code.md");
    expect(readme).toContain("docs/install/github-skills.md");
  });

  it("presents Skill-first onboarding instead of a tool catalog", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("## Skill と MCP の役割");
    expect(readme).toContain("## 最短導入");
    expect(readme).toContain("## 最初の依頼例");
    expect(readme).toContain("## MCP 単体で使う場合");
    expect(readme).not.toContain("npx -y jp-lit-mcp install-skills codex");
    expect(readme).toContain("MCP は検索・取得の道具");
    expect(readme).toContain("Skills によって実際の調査を進めます");
  });

  it("links to the source usage conditions memo", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("docs/source-usage-conditions.md");
  });

  it("mentions the jp-lit verification skill and its role", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("jp-lit-verification");
    expect(readme).toContain("文献検証");
    expect(readme).toContain("実在性");
    expect(readme).toContain("最初の依頼例");
    expect(readme).toContain("使い方ガイド");
  });

  it("explains provisional organization and text-reading limits", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("仮整理");
    expect(readme).toContain("根拠");
    expect(readme).toContain("online=true");
    expect(readme).toContain("エージェントが本文を読んだことを意味しません");
    expect(readme).toContain("調査上の確認優先度");
    expect(readme).toContain("出版社や媒体だけで文献の価値を確定しません");
  });

  it("mentions session trace without changing CSL JSON expectations", () => {
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const reference = readFileSync("docs/reference.md", "utf8");

    expect(readme).toContain("調査経過");
    expect(readme).toContain("検索試行");
    expect(usageGuide).toContain("jp_lit_update_session_trace");
    expect(usageGuide).toContain("CSL JSON には調査経過");
    expect(reference).toContain("jp_lit_update_session_trace");
    expect(reference).toContain("source_plan_count");
    expect(reference).toContain("CSL JSON には trace を混ぜません");
  });

  it("documents offline bibliographies, indexes, and paid database limits in the usage guide", () => {
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    expect(usageGuide).toContain("参考書誌・索引・有料DB");
    expect(usageGuide).toContain("参考書誌確認");
    expect(usageGuide).toContain("有料DB");
    expect(usageGuide).toContain("要有料DB確認");
    expect(usageGuide).toContain("ざっさくプラス");
    expect(usageGuide).toContain("大宅壮一文庫");
    expect(usageGuide).toContain("毎回の注意書き");
  });

  it("documents the specialist explicit sources and fixed-source limits", () => {
    const readme = readFileSync("README.md", "utf8");
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const projectStatus = readFileSync("docs/project-status.md", "utf8");

    expect(readme).toContain("NDL Search");
    expect(readme).toContain("CiNii");
    expect(readme).toContain("J-STAGE");
    expect(readme).toContain("国書");
    expect(readme).toContain("国会・帝国議会会議録");
    expect(readme).toContain("レファレンス協同データベース");
    expect(readme).toContain("jp_lit_search_guides_manuals");
    expect(readme).toContain("jp_lit_search_guides_cases");
    expect(readme).toContain("NDL リサーチ・ナビ");
    expect(readme).toContain("API / MCP source には接続していません");
    expect(readme).toContain("Web 上の調べ方案内");
    expect(readme).toContain("docs/reference.md");

    expect(usageGuide).toContain("日本文学論文");
    expect(usageGuide).toContain("jp_lit_search(source=nijl_articles");
    expect(usageGuide).toContain("jp_lit_search(source=kokusho");
    expect(usageGuide).toContain("jp_lit_search_kokusho_fulltext");
    expect(usageGuide).toContain("jp_lit_search_kokusho_image_tags");
    expect(usageGuide).toContain("jp_lit_search(source=ninjal_bibliography");
    expect(usageGuide).toContain("文化資源 DB や地域アーカイブ DB は固定 source 化しません");

    expect(projectStatus).toContain("対応 source 21 種");
    expect(projectStatus).toContain("nijl_articles");
    expect(projectStatus).toContain("kokusho");
    expect(projectStatus).toContain("ninjal_bibliography");
  });

  it("keeps every public source discoverable in the technical reference", () => {
    const reference = readFileSync("docs/reference.md", "utf8");
    const sourceTable = reference.slice(
      reference.indexOf("## Source 一覧"),
      reference.indexOf("## 共通スキーマ")
    );
    const documentedSources = new Set(
      [...sourceTable.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1])
    );

    for (const source of sourceSchema.options) {
      expect.soft(documentedSources, source).toContain(source);
    }
  });

  it("lists the reference-book source in README's primary source guide", () => {
    const readme = readFileSync("README.md", "utf8");
    const mainSources = readme.slice(
      readme.indexOf("## 主な対応先"),
      readme.indexOf("## ドキュメント")
    );

    expect(mainSources).toContain("`ndl_reference_books`");
    expect(mainSources).toMatch(/参考図書紹介.*既定横断外/);
  });

  it("documents regional public library research as a Skill-guided route", () => {
    const usageGuide = readFileSync("docs/usage-guide.md", "utf8");
    const regionalDoc = readFileSync("docs/regional-public-library-research.md", "utf8");

    expect(usageGuide).toContain("地方人物・地方紙・地方雑誌・郷土資料");
    expect(usageGuide).toContain("docs/regional-public-library-research.md");
    expect(usageGuide).toContain("カーリル図書館MCP");
    expect(usageGuide).toContain("地域候補を優先づけたうえで");
    expect(usageGuide).toContain("`search_libraries` で地域名・館種・ネットワーク名");
    expect(usageGuide).toContain("Web 検索はパスファインダー");
    expect(usageGuide).toContain("県立図書館を基準点として外さない");
    expect(usageGuide).toContain("該当都道府県立図書館");
    expect(usageGuide).toContain("発行地・活動地に対応する中央館");
    expect(usageGuide).toContain("隣接自治体や旧郡域の館");
    expect(usageGuide).toContain("専門図書館・資料室");
    expect(usageGuide).toContain("scripts/plan-regional-library-search.mjs");
    expect(usageGuide).toContain("`search_libraries` で地域名・館種・ネットワーク名");
    expect(usageGuide).toContain("MCP / OAuth 設定を直し");
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("地域資料・地方人物");
    expect(readme).toContain("カーリル図書館MCP");
    expect(readme).toContain("docs/regional-public-library-research.md");
    expect(regionalDoc).toContain("https://calil.jp/ai/");
    expect(regionalDoc).toContain("https://ndlsearch.ndl.go.jp/rnavi/plan/pubpath");
    expect(regionalDoc).toContain("scripts/plan-regional-library-search.mjs");
  });

  it("documents the NDL browser capability independently in every public table and keeps README links resolvable", () => {
    const docs = {
      readme: readFileSync("README.md", "utf8"),
      usage: readFileSync("docs/usage-guide.md", "utf8"),
      reference: readFileSync("docs/reference.md", "utf8"),
      status: readFileSync("docs/project-status.md", "utf8")
    };

    for (const [name, doc] of Object.entries(docs)) {
      expect.soft(doc, `${name}: browser record tool`).toContain(
        "jp_lit_record_ndl_browser_search"
      );
      expect.soft(doc, `${name}: Next Digital boundary`).toContain(
        "jp_lit_search_fulltext"
      );

      const table = extractCapabilityTable(doc);
      expect.soft(table[0], `${name}: capability headers`).toBe(
        "| 経路 | 全文候補検索 | 送信資料ヒット | 本文画像確認 | PDF状態 | cache/session統合 |"
      );
      const apiRow = table.find((row) => row.includes("`jp_lit_search_fulltext`"));
      const browserRow = table.find((row) => row.includes("`jp_lit_record_ndl_browser_search`"));
      expect.soft(apiRow, `${name}: Next Digital row`).toContain("デジコレ本体の範囲は網羅しない");
      expect.soft(browserRow, `${name}: individual transmission boundary`).toContain(
        "個人送信は許可済み既存ログインが必要"
      );
      expect.soft(browserRow, `${name}: onsite boundary`).toContain(
        "`ndl_onsite_only` はログインしても遠隔不可"
      );

      expect
        .soft(lintForbiddenBrowserContractClaims(doc), `${name}: forbidden claims`)
        .toEqual([]);
    }

    expect(docs.status).toContain("公開ツール 30 種");

    const browserSection = docs.readme.slice(
      docs.readme.indexOf("### NDL デジタルコレクション系の OCR 全文を探す"),
      docs.readme.indexOf("\n### ", docs.readme.indexOf("### NDL デジタルコレクション系の OCR 全文を探す") + 4)
    );
    const relativeLinks = [...browserSection.matchAll(/\[[^\]]+\]\((docs\/[^)#]+\.md)#([^)]+)\)/g)];
    const requiredLinks = [
      ["docs/usage-guide.md", "browser観測を同じsessionへ統合する"],
      ["docs/reference.md", "jp_lit_record_ndl_browser_search"]
    ];
    for (const [targetPath, anchor] of requiredLinks) {
      expect
        .soft(relativeLinks.some((link) => link[1] === targetPath && link[2] === anchor), `${targetPath}#${anchor}`)
        .toBe(true);
    }
    for (const [, targetPath, anchor] of relativeLinks) {
      expect.soft(existsSync(targetPath), targetPath).toBe(true);
      if (!existsSync(targetPath)) {
        continue;
      }
      const headings = githubHeadingSlugs(readFileSync(targetPath, "utf8"));
      expect.soft(headings, `${targetPath}#${anchor}`).toContain(anchor);
    }
  });

  it("parses the public browser workflow JSON examples and validates every tool argument schema", () => {
    const usage = readFileSync("docs/usage-guide.md", "utf8");
    const reference = readFileSync("docs/reference.md", "utf8");
    const usageStart = usage.indexOf("#### browser観測を同じsessionへ統合する");
    const usageEnd = usage.indexOf("\n---", usageStart);
    const referenceRecordStart = reference.indexOf("#### `jp_lit_record_ndl_browser_search`");
    const referenceRecordEnd = reference.indexOf("\n#### ", referenceRecordStart + 5);
    const referenceWorkflowStart = reference.indexOf(
      "### API・browser・fulltext候補を統合して注釈・exportする"
    );
    const referenceWorkflowEnd = reference.indexOf("\n### ", referenceWorkflowStart + 4);
    const docs = {
      usage: usage.slice(usageStart, usageEnd),
      reference: [
        reference.slice(referenceRecordStart, referenceRecordEnd),
        reference.slice(referenceWorkflowStart, referenceWorkflowEnd)
      ].join("\n")
    };
    const schemas = {
      jp_lit_record_ndl_browser_search: recordNdlBrowserSearchInputSchema,
      jp_lit_refine_results: refineResultsInputSchema,
      jp_lit_annotate_session: annotateSessionInputSchema,
      jp_lit_export_session: exportSessionInputSchema
    };

    for (const [docName, doc] of Object.entries(docs)) {
      for (const [tool, schema] of Object.entries(schemas)) {
        const call = extractJsonToolCall(doc, tool);
        expect.soft(call.tool, `${docName}: ${tool} wrapper`).toBe(tool);
        const result = schema.safeParse(call.arguments);
        expect.soft(
          result.success,
          `${docName}: ${tool} arguments ${result.success ? "" : result.error.message}`
        ).toBe(true);
      }
    }
  });

  it("separates research session IDs from browser login sessions in usage and reference", () => {
    const docs = {
      usage: readFileSync("docs/usage-guide.md", "utf8"),
      reference: readFileSync("docs/reference.md", "utf8")
    };

    for (const [name, doc] of Object.entries(docs)) {
      const contractStart = doc.indexOf(
        "API tool と `jp_lit_record_ndl_browser_search`"
      );
      expect.soft(contractStart, `${name}: research session contract`).toBeGreaterThanOrEqual(0);
      if (contractStart < 0) {
        continue;
      }
      const contract = doc.slice(contractStart, contractStart + 600);
      const orderedContract = [
        "API tool",
        "jp_lit_record_ndl_browser_search",
        "同じ調査 `session_id`",
        "browser 観測をその調査 session へ記録",
        "browser login session",
        "`login_state`",
        "MCP の調査 `session_id` とは別物"
      ];
      let previous = -1;
      for (const phrase of orderedContract) {
        const index = contract.indexOf(phrase);
        expect.soft(index, `${name}: ${phrase}`).toBeGreaterThan(previous);
        previous = index;
      }

      expect.soft(doc, `${name}: ambiguous API/browser wording`).not.toContain(
        "API 検索と公式画面の観測には同じ `session_id`"
      );
      expect.soft(doc, `${name}: browser does not receive research SID`).not.toMatch(
        /(?:公式ブラウザ|ブラウザ|browser)(?:にも|へ)同じ `session_id`/
      );
      expect.soft(doc, `${name}: authorized browser is not a research SID consumer`).not.toMatch(
        /API検索、許可済み公式ブラウザ、`jp_lit_record_ndl_browser_search` には同じ `session_id`/
      );
    }
  });

  it("documents the bounded browser snippet locator contract", () => {
    const docs = {
      reference: readFileSync("docs/reference.md", "utf8"),
      workflow: readFileSync(
        "skills/jp-lit-research/workflows/fulltext-page-lookup.md",
        "utf8"
      )
    };

    for (const [name, doc] of Object.entries(docs)) {
      expect.soft(doc, `${name}: locator_type`).toContain(
        "`content_index | koma | filename | unknown`"
      );
      expect.soft(doc, `${name}: locator type`).toContain(
        "`locator` は `string | null`"
      );
      expect.soft(doc, `${name}: null meaning`).toContain(
        "画面に表示された locator を記録できない場合は `null`"
      );
      expect.soft(doc, `${name}: snippet bounds`).toContain(
        "`snippets` は item ごとに最大5件、各 snippet の `text` は最大500文字"
      );
    }
  });
});
