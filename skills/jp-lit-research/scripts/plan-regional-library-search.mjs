#!/usr/bin/env node

import { readFileSync } from "node:fs";

const FIELD_TYPES = [
  ["prefectureNames", "prefecture"],
  ["cityNames", "city"],
  ["placeNames", "place"],
  ["publicationPlaces", "publication_place"],
  ["activityPlaces", "activity_place"],
  ["adjacentPlaces", "adjacent_place"],
  ["oldDistrictNames", "old_district"]
];

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function arrayField(input, key) {
  return Array.isArray(input?.[key]) ? unique(input[key]) : [];
}

function readInput() {
  const raw = readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function libraryKeywords(label, type) {
  if (type === "prefecture") {
    const keywords = [
      `${label}立図書館`,
      `${label} 図書館`,
      `${label} 郷土資料`
    ];
    if (label === "東京都" || label === "大阪府") {
      keywords.splice(1, 0, `${label}立中央図書館`);
    }
    return keywords;
  }
  if (type === "city") {
    return [`${label} 中央図書館`, `${label} 図書館`, `${label} 郷土資料`];
  }
  if (type === "publication_place" || type === "activity_place") {
    return [`${label} 中央図書館`, `${label} 図書館`, `${label} 郷土資料`];
  }
  if (type === "adjacent_place" || type === "old_district") {
    return [`${label} 図書館`, `${label} 郷土資料`, `${label} 史料`];
  }
  return [`${label} 図書館`, `${label} 郷土資料`, `${label} 中央図書館`];
}

function webSearchQueries(label, type) {
  if (type === "prefecture") {
    return [
      `${label} 図書館 郷土資料`,
      `${label} 都道府県立図書館 パスファインダー`,
      `${label} 新聞 所蔵 図書館`
    ];
  }
  if (type === "city" || type === "place") {
    return [
      `${label} 中央図書館 郷土資料`,
      `${label} 図書館 パスファインダー`,
      `${label} 郷土資料 図書館`
    ];
  }
  if (type === "publication_place" || type === "activity_place") {
    return [
      `${label} 中央図書館`,
      `${label} 郷土資料 図書館`,
      `${label} 地域資料 図書館`
    ];
  }
  if (type === "adjacent_place" || type === "old_district") {
    return [
      `${label} 郷土資料 図書館`,
      `${label} 史料 図書館`,
      `${label} パスファインダー`
    ];
  }
  return [`${label} 図書館`, `${label} 郷土資料`];
}

function inferPrefecture(label) {
  const match = label.match(/^(.*?[都道府県])/);
  return match?.[1] ?? null;
}

function buildRegionCandidates(input) {
  const candidates = [];
  const seenLabels = new Set();
  for (const field of ["cityNames", "placeNames", "publicationPlaces", "activityPlaces"]) {
    for (const label of arrayField(input, field)) {
      const pref = inferPrefecture(label);
      if (!pref || seenLabels.has(pref)) {
        continue;
      }
      seenLabels.add(pref);
      candidates.push({
        label: pref,
        type: "prefecture",
        webSearchQueries: webSearchQueries(pref, "prefecture"),
        searchLibrariesKeywords: libraryKeywords(pref, "prefecture")
      });
    }
  }
  for (const [field, type] of FIELD_TYPES) {
    for (const label of arrayField(input, field)) {
      if (seenLabels.has(label)) {
        continue;
      }
      seenLabels.add(label);
      candidates.push({
        label,
        type,
        webSearchQueries: webSearchQueries(label, type),
        searchLibrariesKeywords: libraryKeywords(label, type)
      });
    }
  }
  return candidates;
}

function buildSpecialistLibraryCandidates(input) {
  const labels = unique([
    ...arrayField(input, "specialistLibraryNames"),
    ...arrayField(input, "specialistLibraryKeywords"),
    ...arrayField(input, "subjectKeywords")
  ]);

  return labels.map((label) => ({
    label,
    type: "specialist_keyword",
    searchLibrariesKeywords: [
      label,
      `${label} 専門図書館`,
      `${label} 資料室`,
      `${label} 図書館`,
      `${label} 博物館`,
      `${label} アーカイブ`
    ]
  }));
}

function buildSpecialistDiscoveryQueries(input) {
  const subjects = unique([
    ...arrayField(input, "subjectKeywords"),
    ...arrayField(input, "specialistLibraryKeywords")
  ]);
  const people = arrayField(input, "personNames");
  const queries = [];
  const seen = new Set();

  for (const subject of subjects) {
    addQuery(queries, seen, "専門領域 + 専門資料機関", `${subject} 専門図書館 OR 資料室 OR アーカイブ`);
    addQuery(queries, seen, "専門領域 + 博物館/記念館", `${subject} 博物館 OR 記念館`);
    addQuery(queries, seen, "専門領域 + 団体/協会", `${subject} 協会 OR 学会 OR 研究会`);
    addQuery(queries, seen, "専門領域 + 機関誌", `${subject} 機関誌 OR 会報 OR 雑誌`);
    for (const person of people) {
      addQuery(queries, seen, "人物名 + 専門領域", `${person} ${subject}`);
      addQuery(queries, seen, "人物名 + 専門領域資料", `${person} ${subject} 資料`);
    }
  }

  return queries;
}

function buildConcreteNameDiscoveryQueries(input) {
  const people = arrayField(input, "personNames");
  const media = arrayField(input, "mediaNames");
  const organizations = arrayField(input, "organizationNames");
  const places = [
    ...arrayField(input, "placeNames"),
    ...arrayField(input, "publicationPlaces"),
    ...arrayField(input, "activityPlaces")
  ];
  const queries = [];
  const seen = new Set();

  for (const person of people) {
    addQuery(queries, seen, "人物名 + 出身地", `${person} 出身地`);
    addQuery(queries, seen, "人物名 + 地域ゆかり", `${person} ゆかり 地域`);
    addQuery(queries, seen, "人物名 + 郷土人物", `${person} 郷土人物`);
    for (const place of places) {
      addQuery(queries, seen, "人物名 + 地域確認", `${person} ${place}`);
      addQuery(queries, seen, "人物名 + 地域図書館", `${person} ${place} 図書館`);
      addQuery(queries, seen, "人物名 + 地域郷土資料", `${person} ${place} 郷土資料`);
    }
    addQuery(queries, seen, "人物名 + 図書館（補助）", `${person} 図書館`);
    addQuery(queries, seen, "人物名 + 文学館/記念館（補助）", `${person} 文学館 OR 記念館 OR 資料館`);
  }

  for (const title of media) {
    addQuery(queries, seen, "媒体名 + 所蔵図書館", `${title} 所蔵 図書館`);
    addQuery(queries, seen, "媒体名 + 新聞/雑誌所蔵", `${title} 新聞 雑誌 所蔵`);
    addQuery(queries, seen, "媒体名 + 資料室", `${title} 資料室`);
    for (const place of places) {
      addQuery(queries, seen, "媒体名 + 地域所蔵", `${title} ${place} 所蔵 図書館`);
    }
  }

  for (const organization of organizations) {
    addQuery(queries, seen, "団体名 + 記念誌/沿革", `${organization} 記念誌 沿革`);
    addQuery(queries, seen, "団体名 + 図書館", `${organization} 図書館`);
    addQuery(queries, seen, "団体名 + 資料室", `${organization} 資料室`);
    for (const place of places) {
      addQuery(queries, seen, "団体名 + 地域資料", `${organization} ${place} 郷土資料`);
    }
  }

  return queries;
}

function addQuery(queries, seen, purpose, free) {
  const normalized = free.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  queries.push({ purpose, free: normalized });
}

function addKeywordQuery(queries, seen, purpose, keyword) {
  const normalized = keyword.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  queries.push({ purpose, keyword: normalized });
}

function buildSearchLibrariesQueries(regionCandidates, specialistLibraryCandidates) {
  const queries = [];
  const seen = new Set();

  for (const candidate of regionCandidates) {
    for (const keyword of candidate.searchLibrariesKeywords ?? []) {
      let purpose = "地域名 + 図書館";
      if (/立図書館|立中央図書館/.test(keyword)) {
        purpose = "都道府県立図書館";
      } else if (/郷土資料/.test(keyword)) {
        purpose = "郷土資料候補";
      } else if (/中央図書館/.test(keyword)) {
        purpose = "市区町村中央館";
      }
      addKeywordQuery(queries, seen, purpose, keyword);
    }
  }

  for (const candidate of specialistLibraryCandidates) {
    for (const keyword of candidate.searchLibrariesKeywords ?? []) {
      addKeywordQuery(queries, seen, "専門資料機関候補", keyword);
    }
  }

  return queries;
}

function buildSearchBooksQueries(input) {
  const people = arrayField(input, "personNames");
  const places = arrayField(input, "placeNames");
  const activityPlaces = arrayField(input, "activityPlaces");
  const media = arrayField(input, "mediaNames");
  const organizations = arrayField(input, "organizationNames");
  const publicationPlaces = arrayField(input, "publicationPlaces");
  const adjacentPlaces = arrayField(input, "adjacentPlaces");
  const oldDistrictNames = arrayField(input, "oldDistrictNames");
  const queries = [];
  const seen = new Set();

  for (const person of people) {
    addQuery(queries, seen, "人物名", person);
    for (const place of places) {
      addQuery(queries, seen, "人物 + 地名", `${person} ${place}`);
    }
    for (const place of activityPlaces) {
      addQuery(queries, seen, "人物 + 活動地", `${person} ${place}`);
    }
  }

  for (const title of media) {
    addQuery(queries, seen, "媒体名", title);
    for (const place of publicationPlaces.length > 0 ? publicationPlaces : places) {
      addQuery(queries, seen, "媒体名 + 発行地", `${title} ${place}`);
    }
  }

  for (const organization of organizations) {
    addQuery(queries, seen, "団体名", organization);
  }

  for (const place of places) {
    addQuery(queries, seen, "地名 + 郷土史", `${place} 郷土史`);
    addQuery(queries, seen, "地名 + 人物", `${place} 人物`);
  }
  for (const place of publicationPlaces) {
    addQuery(queries, seen, "発行地 + 郷土資料", `${place} 郷土資料`);
  }
  for (const place of activityPlaces) {
    addQuery(queries, seen, "活動地 + 郷土資料", `${place} 郷土資料`);
  }
  for (const district of oldDistrictNames) {
    addQuery(queries, seen, "旧郡域 + 郷土史", `${district} 郷土史`);
  }
  for (const place of adjacentPlaces) {
    addQuery(queries, seen, "隣接自治体 + 郷土資料", `${place} 郷土資料`);
  }

  return queries;
}

function normalizeClientEnvironment(input) {
  const value = String(
    input?.clientEnvironment ?? input?.environment ?? input?.client ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");
  if (!value) {
    return "unspecified";
  }
  if (value === "claude" || value === "claude_code") {
    return "claude_code";
  }
  if (value === "chatgpt" || value === "chat_gpt" || value === "gpt") {
    return "chatgpt";
  }
  if (value === "codex_app" || value === "codex_cli") {
    return "codex";
  }
  return value;
}

function shouldIncludeChatGptPrompt(input, clientEnvironment) {
  return (
    clientEnvironment === "codex" ||
    clientEnvironment === "chatgpt" ||
    input?.promptMode === true ||
    input?.outputPrompt === true ||
    input?.mode === "prompt"
  );
}

function buildCalilAccess(input, clientEnvironment) {
  const directClient =
    clientEnvironment === "cursor" || clientEnvironment === "claude_code";
  const codexClient = clientEnvironment === "codex";
  const chatGptClient = clientEnvironment === "chatgpt";

  return {
    clientEnvironment,
    directUse:
      directClient
        ? "available_if_user_registered_calil_ai_remote_mcp"
        : "not_assumed",
    codexFallback:
      codexClient
        ? "generate_chatgpt_calil_prompt_for_user_to_run"
        : "not_needed",
    notes: directClient
      ? [
          "Cursor / Claude Code では、ユーザーがカーリルAI Remote MCPを事前登録・OAuth認可していれば同一エージェントから search_libraries / search_books を使う。",
          "カーリルの結果は jp-lit 側の NDL / CiNii / Japan Search / レファ協結果と統合評価する。"
        ]
      : chatGptClient
        ? [
            "ChatGPT はカーリルAI側の対応先だが、この repo の jp-lit-mcp / Skill をそのまま動かす導入先ではない。",
            "jp-lit 側で作った検索計画を貼り付け、結果を jp-lit 側へ戻して統合評価する。"
          ]
        : codexClient
          ? [
              "Codex ではカーリルAI Remote MCP の直接利用を前提にしない。",
              "jp-lit 側で検索計画と貼り付け用プロンプトを作り、ユーザーが ChatGPT + カーリルAI で実行した結果を Codex に戻す。"
            ]
          : [
              "カーリルAI Remote MCP を同一エージェントから使えるかは実行環境の MCP / OAuth 対応に依存する。",
              "不明な場合は、貼り付け用プロンプトを生成して ChatGPT + カーリルAI で実行する。"
            ]
  };
}

function formatBulletQueries(queries, key) {
  return queries
    .slice(0, 24)
    .map((query, index) => `${index + 1}. ${query.purpose}: ${query[key]}`)
    .join("\n");
}

function buildChatGptCalilPrompt(input, planDraft) {
  const subject = unique([
    ...arrayField(input, "personNames"),
    ...arrayField(input, "mediaNames"),
    ...arrayField(input, "organizationNames"),
    ...arrayField(input, "topics")
  ]).join(" / ") || "地域資料・地方公共図書館調査";
  const regionLabels = planDraft.regionCandidates
    .map((candidate) => `${candidate.label}（${candidate.type}）`)
    .join("、") || "未確定";
  const specialistLabels = planDraft.specialistLibraryCandidates
    .map((candidate) => candidate.label)
    .join("、") || "未確定";
  const libraryQueries = formatBulletQueries(
    planDraft.searchLibrariesQueries,
    "keyword"
  );
  const bookQueries = formatBulletQueries(planDraft.searchBooksQueries, "free");

  return [
    "あなたはカーリルAI Remote MCPを使える調査補助者です。以下の地域資料・地方公共図書館調査を実行してください。",
    "",
    `調査対象: ${subject}`,
    `地域候補: ${regionLabels}`,
    `専門領域・専門資料機関候補: ${specialistLabels}`,
    "",
    "手順:",
    "1. search_libraries で下の図書館検索語を順に試し、候補館名、systemid、地域・館種・採用理由を整理してください。",
    "2. 最大15館に絞るときは、県立図書館を基準点として外さず、市区町村中央館、広域ネットワーク、発行地・活動地の中央館、郷土資料室・分館、隣接自治体や旧郡域の館、専門図書館・資料室を組み合わせてください。",
    "3. 採用した systemid 群に対して search_books を使い、下の蔵書検索語を試してください。地方紙・地方雑誌は記事名ではなく媒体名・巻号・発行地を重視してください。",
    "4. 結果は、検索語、systemid、館名、書誌、所蔵館、所蔵範囲、閲覧条件、ヒットしなかった検索語、追加で各館OPACやレファレンス確認が必要な点に分けて返してください。",
    "5. カーリルで見つからない文学館・記念館・資料館・資料室・専門団体は、検索できなかったものとして明示し、Web/直接OPAC/レファレンス照会の次アクションに分けてください。",
    "",
    "search_libraries に渡す検索語:",
    libraryQueries || "なし",
    "",
    "search_books に渡す検索語:",
    bookQueries || "なし",
    "",
    "返答フォーマット:",
    "- 図書館候補: 館名 / systemid / 採用理由 / 優先度",
    "- 蔵書候補: 書誌 / 検索語 / 所蔵館 / 所蔵・閲覧条件 / 確認状態",
    "- ヒットなし・保留: 検索語 / 理由",
    "- 次アクション: 各館OPAC、新聞・雑誌所蔵一覧、専門資料機関、レファレンス相談"
  ].join("\n");
}

function buildPlan(input) {
  const topics = arrayField(input, "topics");
  const regionCandidates = buildRegionCandidates(input);
  const specialistLibraryCandidates = buildSpecialistLibraryCandidates(input);
  const searchLibrariesQueries = buildSearchLibrariesQueries(
    regionCandidates,
    specialistLibraryCandidates
  );
  const searchBooksQueries = buildSearchBooksQueries(input);
  const clientEnvironment = normalizeClientEnvironment(input);
  const hasLocalPersonTopic = topics.some((topic) =>
    /地方人物|郷土人物|出身者|在住者/.test(topic)
  );
  const hasLocalMediaTopic = topics.some((topic) =>
    /地方紙|地方雑誌|地域紙|ミニコミ|自治体広報|機関誌/.test(topic)
  );
  const regionalSignals = unique([
    ...topics,
    ...(arrayField(input, "mediaNames").length && !hasLocalMediaTopic
      ? ["地方紙・地方雑誌"]
      : []),
    ...(arrayField(input, "organizationNames").length ? ["地域団体資料"] : [])
  ]);

  const plan = {
    mode: "regional_public_library_search_plan",
    regionalSignals,
    regionCandidates,
    libraryPriority: [
      "該当都道府県立図書館（地域資料の基準点として外さない）",
      "該当市区町村中央館",
      "県内/広域の図書館ネットワーク",
      "発行地・活動地に対応する中央館",
      "郷土資料室・分館",
      "隣接自治体や旧郡域の館",
      "専門図書館・資料室（カーリルで見つかる場合）"
    ],
    calilMcp: {
      recommended:
        regionCandidates.length > 0 || specialistLibraryCandidates.length > 0,
      tools: ["search_libraries", "search_books"],
      maxSystems: 15,
      workflow:
        "カーリル MCP の search_libraries で地域名・館種・ネットワーク名・専門資料機関名を検索し、候補の systemid を得る。Web 検索はパスファインダー、新聞/雑誌所蔵一覧、郷土資料ページ、カーリルで見つからない資料室の補助確認に使う。",
      restApiUse: "ISBN既知の所蔵確認のみ。キーワード蔵書検索には使わない。",
      access: buildCalilAccess(input, clientEnvironment)
    },
    specialistLibraryCandidates,
    specialistDiscoveryQueries: buildSpecialistDiscoveryQueries(input),
    searchLibrariesQueries,
    concreteNameDiscoveryQueries: buildConcreteNameDiscoveryQueries(input),
    searchBooksQueries,
    fallbackActions: [
      "地域パスファインダーを確認する",
      "各館 OPAC を直接確認する",
      "新聞所蔵一覧・雑誌所蔵一覧を確認する",
      "レファレンス協同データベースの地域事例を確認する",
      "専門団体・資料室・機関誌/会報の照会先を確認する",
      "図書館レファレンス相談を次アクションに残す"
    ]
  };

  if (shouldIncludeChatGptPrompt(input, clientEnvironment)) {
    plan.chatGptCalilPrompt = buildChatGptCalilPrompt(input, plan);
  }

  return plan;
}

try {
  const input = readInput();
  process.stdout.write(`${JSON.stringify(buildPlan(input), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`regional library planner input error: ${error.message}\n`);
  process.exitCode = 1;
}
