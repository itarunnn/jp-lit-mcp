import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

interface RegionalLibraryPlan {
  mode: string;
  regionalSignals: string[];
  regionCandidates: Array<{
    label: string;
    type: string;
    webSearchQueries: string[];
    searchLibrariesKeywords: string[];
  }>;
  libraryPriority: string[];
  calilMcp: {
    recommended: boolean;
    tools: string[];
    maxSystems: number;
    workflow: string;
    restApiUse: string;
    access: {
      clientEnvironment: string;
      directUse: string;
      notes: string[];
    };
  };
  specialistLibraryCandidates: Array<{
    label: string;
    type: string;
    searchLibrariesKeywords: string[];
  }>;
  specialistDiscoveryQueries: Array<{
    purpose: string;
    free: string;
  }>;
  searchLibrariesQueries: Array<{
    purpose: string;
    keyword: string;
  }>;
  concreteNameDiscoveryQueries: Array<{
    purpose: string;
    free: string;
  }>;
  searchBooksQueries: Array<{
    purpose: string;
    free: string;
  }>;
  fallbackActions: string[];
}

function runPlanner(input: unknown): RegionalLibraryPlan {
  const output = execFileSync(
    process.execPath,
    ["skills/jp-lit-research/scripts/plan-regional-library-search.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: `${JSON.stringify(input)}\n`
    }
  );
  return JSON.parse(output) as RegionalLibraryPlan;
}

describe("regional library planning script", () => {
  it("turns local-person and local-periodical clues into a Calil MCP plan", () => {
    const plan = runPlanner({
      personNames: ["山田太郎"],
      placeNames: ["岐阜県中津川市", "美濃"],
      activityPlaces: ["岐阜県恵那市"],
      mediaNames: ["東濃新報"],
      organizationNames: ["坂下郷土史研究会"],
      publicationPlaces: ["中津川"],
      adjacentPlaces: ["長野県木曽郡"],
      oldDistrictNames: ["恵那郡"],
      specialistLibraryKeywords: ["新聞ライブラリー", "文学館"],
      topics: ["地方人物", "地方紙"]
    });

    expect(plan.mode).toBe("regional_public_library_search_plan");
    expect(plan.regionalSignals).toContain("地方人物");
    expect(plan.regionalSignals).toContain("地方紙");
    expect(plan.regionalSignals).not.toContain("地方紙・地方雑誌");
    expect(plan.regionCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "岐阜県",
          type: "prefecture",
          webSearchQueries: expect.arrayContaining([
            "岐阜県 図書館 郷土資料",
            "岐阜県 新聞 所蔵 図書館"
          ]),
          searchLibrariesKeywords: expect.arrayContaining([
            "岐阜県立図書館",
            "岐阜県 郷土資料"
          ])
        }),
        expect.objectContaining({
          label: "岐阜県中津川市",
          type: "place",
          webSearchQueries: expect.arrayContaining([
            "岐阜県中津川市 中央図書館 郷土資料",
            "岐阜県中津川市 図書館 パスファインダー"
          ]),
          searchLibrariesKeywords: expect.arrayContaining([
            "岐阜県中津川市 図書館",
            "岐阜県中津川市 郷土資料"
          ])
        }),
        expect.objectContaining({
          label: "中津川",
          type: "publication_place"
        })
      ])
    );
    expect(plan.libraryPriority).toEqual([
      "該当都道府県立図書館（地域資料の基準点として外さない）",
      "該当市区町村中央館",
      "県内/広域の図書館ネットワーク",
      "発行地・活動地に対応する中央館",
      "郷土資料室・分館",
      "隣接自治体や旧郡域の館",
      "専門図書館・資料室（カーリルで見つかる場合）"
    ]);
    expect(plan.specialistLibraryCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "新聞ライブラリー",
          type: "specialist_keyword",
          searchLibrariesKeywords: expect.arrayContaining([
            "新聞ライブラリー",
            "新聞ライブラリー 専門図書館",
            "新聞ライブラリー 資料室"
          ])
        })
      ])
    );
    expect(plan.calilMcp).toEqual({
      recommended: true,
      tools: ["search_libraries", "search_books"],
      maxSystems: 15,
      workflow:
        "カーリル MCP の search_libraries で地域名・館種・ネットワーク名・専門資料機関名を検索し、候補の systemid を得る。Web 検索はパスファインダー、新聞/雑誌所蔵一覧、郷土資料ページ、カーリルで見つからない資料室の補助確認に使う。",
      restApiUse: "ISBN既知の所蔵確認のみ。キーワード蔵書検索には使わない。",
      access: {
        clientEnvironment: "unspecified",
        directUse: "not_assumed",
        notes: [
          "カーリル図書館MCPを同一エージェントから使えるかは実行環境の MCP / OAuth 対応に依存する。",
          "接続できない場合は、地域パスファインダー、各館 OPAC、新聞・雑誌所蔵一覧、図書館レファレンス相談を次アクションに残す。"
        ]
      }
    });
    expect(plan.searchLibrariesQueries).toEqual(
      expect.arrayContaining([
        { purpose: "地域名 + 図書館", keyword: "岐阜県中津川市 図書館" },
        { purpose: "都道府県立図書館", keyword: "岐阜県立図書館" },
        { purpose: "郷土資料候補", keyword: "岐阜県中津川市 郷土資料" }
      ])
    );
    expect(plan.concreteNameDiscoveryQueries).toEqual(
      expect.arrayContaining([
        { purpose: "人物名 + 出身地", free: "山田太郎 出身地" },
        { purpose: "人物名 + 地域ゆかり", free: "山田太郎 ゆかり 地域" },
        { purpose: "人物名 + 郷土人物", free: "山田太郎 郷土人物" },
        { purpose: "人物名 + 地域確認", free: "山田太郎 岐阜県中津川市" },
        { purpose: "人物名 + 地域図書館", free: "山田太郎 岐阜県中津川市 図書館" },
        { purpose: "人物名 + 図書館（補助）", free: "山田太郎 図書館" },
        { purpose: "人物名 + 文学館/記念館（補助）", free: "山田太郎 文学館 OR 記念館 OR 資料館" },
        { purpose: "媒体名 + 所蔵図書館", free: "東濃新報 所蔵 図書館" },
        { purpose: "媒体名 + 地域所蔵", free: "東濃新報 中津川 所蔵 図書館" },
        { purpose: "団体名 + 記念誌/沿革", free: "坂下郷土史研究会 記念誌 沿革" },
        { purpose: "団体名 + 資料室", free: "坂下郷土史研究会 資料室" }
      ])
    );
    expect(plan.searchBooksQueries).toEqual(
      expect.arrayContaining([
        { purpose: "人物 + 地名", free: "山田太郎 岐阜県中津川市" },
        { purpose: "人物 + 活動地", free: "山田太郎 岐阜県恵那市" },
        { purpose: "媒体名", free: "東濃新報" },
        { purpose: "媒体名 + 発行地", free: "東濃新報 中津川" },
        { purpose: "団体名", free: "坂下郷土史研究会" },
        { purpose: "旧郡域 + 郷土史", free: "恵那郡 郷土史" },
        { purpose: "隣接自治体 + 郷土資料", free: "長野県木曽郡 郷土資料" }
      ])
    );
    expect(plan.fallbackActions).toContain("地域パスファインダーを確認する");
    expect(plan.fallbackActions).toContain("新聞所蔵一覧・雑誌所蔵一覧を確認する");
    expect(plan.fallbackActions).toContain("専門団体・資料室・機関誌/会報の照会先を確認する");
  });

  it("deduplicates repeated clues and keeps the 15-library constraint explicit", () => {
    const plan = runPlanner({
      personNames: ["山田太郎", "山田太郎"],
      placeNames: ["秋田県", "秋田県"],
      adjacentPlaces: ["旧河辺郡", "旧河辺郡"],
      mediaNames: ["秋田魁新報", "秋田魁新報"],
      specialistLibraryKeywords: ["新聞ライブラリー", "新聞ライブラリー"],
      topics: ["郷土資料"]
    });

    expect(plan.regionCandidates.map((candidate) => candidate.label)).toEqual([
      "秋田県",
      "旧河辺郡"
    ]);
    expect(plan.regionCandidates[0]?.searchLibrariesKeywords).toContain(
      "秋田県立図書館"
    );
    expect(plan.regionCandidates[0]?.searchLibrariesKeywords).not.toContain(
      "秋田県立中央図書館"
    );
    expect(plan.searchBooksQueries.filter((query) => query.free === "山田太郎"))
      .toHaveLength(1);
    expect(plan.searchBooksQueries.filter((query) => query.free === "秋田魁新報"))
      .toHaveLength(1);
    expect(
      plan.specialistLibraryCandidates.map((candidate) => candidate.label)
    ).toEqual(["新聞ライブラリー"]);
    expect(
      plan.searchBooksQueries.filter(
        (query) => query.free === "旧河辺郡 郷土資料"
      )
    ).toHaveLength(1);
    expect(plan.calilMcp.maxSystems).toBe(15);
  });

  it("adds central-prefectural library keywords for Tokyo-style names", () => {
    const plan = runPlanner({
      placeNames: ["東京都港区"],
      topics: ["地方人物"]
    });

    expect(plan.regionCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "東京都",
          type: "prefecture",
          webSearchQueries: expect.arrayContaining([
            "東京都 図書館 郷土資料",
            "東京都 都道府県立図書館 パスファインダー"
          ]),
          searchLibrariesKeywords: expect.arrayContaining([
            "東京都立中央図書館",
            "東京都立図書館"
          ])
        }),
        expect.objectContaining({
          label: "東京都港区",
          type: "place",
          searchLibrariesKeywords: expect.arrayContaining([
            "東京都港区 図書館",
            "東京都港区 中央図書館"
          ])
        })
      ])
    );
  });

  it("does not treat every person name as a local-person case", () => {
    const plan = runPlanner({
      personNames: ["夏目漱石"],
      topics: ["作家研究"]
    });

    expect(plan.regionalSignals).toEqual(["作家研究"]);
    expect(plan.regionCandidates).toEqual([]);
    expect(plan.calilMcp.recommended).toBe(false);
    expect(plan.concreteNameDiscoveryQueries).toEqual(
      expect.arrayContaining([
        { purpose: "人物名 + 出身地", free: "夏目漱石 出身地" },
        { purpose: "人物名 + 地域ゆかり", free: "夏目漱石 ゆかり 地域" },
        { purpose: "人物名 + 郷土人物", free: "夏目漱石 郷土人物" }
      ])
    );
  });

  it("adds subject-specialist routes without requiring a known library name", () => {
    const plan = runPlanner({
      personNames: ["山田太郎"],
      subjectKeywords: ["演芸", "地域芸能"],
      topics: ["人物文献探索"]
    });

    expect(plan.regionCandidates).toEqual([]);
    expect(plan.calilMcp.recommended).toBe(true);
    expect(plan.specialistLibraryCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "演芸",
          type: "specialist_keyword",
          searchLibrariesKeywords: expect.arrayContaining([
            "演芸 専門図書館",
            "演芸 資料室",
            "演芸 博物館",
            "演芸 アーカイブ"
          ])
        })
      ])
    );
    expect(plan.specialistDiscoveryQueries).toEqual(
      expect.arrayContaining([
        { purpose: "専門領域 + 専門資料機関", free: "演芸 専門図書館 OR 資料室 OR アーカイブ" },
        { purpose: "専門領域 + 団体/協会", free: "演芸 協会 OR 学会 OR 研究会" },
        { purpose: "専門領域 + 機関誌", free: "演芸 機関誌 OR 会報 OR 雑誌" },
        { purpose: "人物名 + 専門領域", free: "山田太郎 演芸" },
        { purpose: "人物名 + 専門領域資料", free: "山田太郎 演芸 資料" }
      ])
    );
    expect(plan.fallbackActions).toContain("専門団体・資料室・機関誌/会報の照会先を確認する");
  });

  it("treats Codex as a direct Calil MCP environment after OAuth login", () => {
    const plan = runPlanner({
      clientEnvironment: "codex",
      personNames: ["阿部徳蔵"],
      placeNames: ["東京都"],
      subjectKeywords: ["演芸"],
      topics: ["人物文献探索"]
    });

    expect(plan.calilMcp.access).toEqual({
      clientEnvironment: "codex",
      directUse: "available_after_codex_mcp_login",
      notes: [
        "Codex では `codex mcp add calil --url https://mcp-beta.calil.jp/mcp` と `codex mcp login calil` による直結を通常ルートにする。",
        "初回 OAuth 認可後は、保存された認証情報を使って新しい Codex セッションから search_libraries / search_books を呼ぶ。接続できない場合は MCP / OAuth 設定を直し、必要に応じて各館 OPAC や図書館レファレンスへ進む。"
      ]
    });
    expect(Object.keys(plan)).not.toContain("chatGpt" + "CalilPrompt");
  });

  it("normalizes Codex app aliases to direct Calil MCP access", () => {
    const plan = runPlanner({
      clientEnvironment: "codex-app",
      placeNames: ["岐阜県中津川市"],
      mediaNames: ["東濃新報"],
      topics: ["地方紙"]
    });

    expect(plan.calilMcp.access.clientEnvironment).toBe("codex");
    expect(plan.calilMcp.access.directUse).toBe(
      "available_after_codex_mcp_login"
    );
    expect(Object.keys(plan)).not.toContain("chatGpt" + "CalilPrompt");
  });

  it("treats Cursor and Claude Code as direct Calil MCP environments", () => {
    for (const clientEnvironment of ["cursor", "claude-code"]) {
      const plan = runPlanner({
        clientEnvironment,
        placeNames: ["岐阜県中津川市"],
        topics: ["地方人物"]
      });

      expect(plan.calilMcp.access.directUse).toBe(
        "available_if_user_registered_calil_ai_remote_mcp"
      );
      expect(Object.keys(plan)).not.toContain("chatGpt" + "CalilPrompt");
    }
  });

  it("does not emit a ChatGPT copy-paste fallback plan", () => {
    const plan = runPlanner({
      clientEnvironment: "chatgpt",
      placeNames: ["岐阜県中津川市"],
      topics: ["地方人物"]
    });

    expect(plan.calilMcp.access).toEqual({
      clientEnvironment: "chatgpt",
      directUse: "not_assumed",
      notes: [
        "ChatGPT はカーリル図書館MCP側の対応先だが、この repo の jp-lit-mcp / Skill をそのまま動かす導入先ではない。",
        "接続できない場合は、地域パスファインダー、各館 OPAC、新聞・雑誌所蔵一覧、図書館レファレンス相談を次アクションに残す。"
      ]
    });
    expect(JSON.stringify(plan)).not.toContain("貼り付け");
    expect(JSON.stringify(plan)).not.toContain("戻して");
    expect(Object.keys(plan)).not.toContain("chatGpt" + "CalilPrompt");
  });
});
