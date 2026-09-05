import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  extractCandidateItems,
  mergeSameSourceRecordItems,
  normalizeCandidateResult,
  readCandidateResult
} from "../src/lib/candidateResultAdapters.js";
import {
  candidateResultRefSchema,
  isCandidateResultTool
} from "../src/lib/candidateResults.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";

const searchKey = `sha256-${"a".repeat(64)}`;
const fulltextKey = `sha256-${"b".repeat(64)}`;
const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-candidate-results-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

const searchItem = {
  source: "ndl_digital" as const,
  source_id: "R100000039-I1907653",
  title: "帝国憲法大要（NDL Search）",
  subtitle: null,
  title_reading: null,
  authors: [{ name: "斉藤隆夫", role: "author" }],
  publisher: "憲政公論社",
  journal_title: null,
  issued_at: "1926",
  issued_at_label: "1926",
  issued_at_precision: "year" as const,
  summary: null,
  url: "https://ndlsearch.ndl.go.jp/books/R100000039-I1907653",
  availability: {
    online: false,
    digital_collection: true
  },
  material_type: "図書",
  subjects: ["憲法"],
  table_of_contents: [],
  source_metadata: {
    provider_id: "ndl-dl"
  },
  duplicate_key: null,
  duplicate_count: 1,
  related_records: []
};

const fulltextPayload = {
  keyword: "普通選挙法",
  searchfield: "contentonly" as const,
  total: 1,
  from: 0,
  items: [{
    pid: "1907653",
    viewer_url: "https://dl.ndl.go.jp/pid/1907653",
    title: "帝国憲法大要",
    volume: null,
    responsibility: "斉藤隆夫 著",
    publisher: "憲政公論社",
    published: "大正15",
    publishyear: 1926,
    ndc: "323",
    bib_id: "000000000001",
    call_no: "特1-1",
    page_count: 123,
    is_classic: false,
    highlights: ["普通選挙法"]
  }],
  raw: {}
};

const browserObservation = {
  checked_at: "2026-09-05T12:00:00+09:00",
  login_state: "logged_in_existing_session",
  query: "普通選挙法",
  access_scope: "individual_transmission",
  access_label: "個人送信で閲覧可能",
  snippets: [{
    text: "普通選挙法",
    locator_type: "koma",
    locator: "67"
  }],
  item_fulltext_state: "searched",
  hit_locations: ["67–73コマ"],
  content_state: "page_image_checked",
  print_file_state: "dialog_available"
};

const browserItem = {
  ...searchItem,
  title: "帝国憲法大要（ブラウザ）",
  publisher: null,
  source_metadata: {
    pid: "1907653",
    candidate_origins: ["ndl_digital_browser"],
    browser_observations: [browserObservation]
  }
};

const browserOutputPayload = {
  query: "普通選挙法",
  source: "ndl_digital" as const,
  page: 1,
  limit: 100 as const,
  total: 1,
  items: [browserItem],
  observation: {
    method: "browser" as const,
    service: "ndl_digital_collections" as const,
    checked_at: "2026-09-05T12:00:00+09:00",
    login_state: "logged_in_existing_session" as const,
    reported_total: 1,
    total_relation: "reported_exact" as const,
    observed_count: 1,
    filters: {
      access_scopes: ["transmission" as const],
      material_types: ["図書"],
      raw_labels: ["送信サービスで閲覧可能"]
    }
  }
};

const olderBrowserObservation = {
  ...browserObservation,
  checked_at: "2026-09-04T12:00:00+09:00",
  access_label: "送信サービスで閲覧可能"
};

const reorderedOlderBrowserObservation = {
  print_file_state: olderBrowserObservation.print_file_state,
  content_state: olderBrowserObservation.content_state,
  hit_locations: olderBrowserObservation.hit_locations,
  item_fulltext_state: olderBrowserObservation.item_fulltext_state,
  snippets: olderBrowserObservation.snippets,
  access_label: olderBrowserObservation.access_label,
  access_scope: olderBrowserObservation.access_scope,
  query: olderBrowserObservation.query,
  login_state: olderBrowserObservation.login_state,
  checked_at: olderBrowserObservation.checked_at
};

describe("candidate result adapters", () => {
  it("candidate result として3種類の tool/ref だけを受理する", () => {
    const tools = [
      "jp_lit_search",
      "jp_lit_search_fulltext",
      "jp_lit_record_ndl_browser_search"
    ];

    expect(tools.every(isCandidateResultTool)).toBe(true);
    expect(isCandidateResultTool("jp_lit_get_record")).toBe(false);
    expect(candidateResultRefSchema.safeParse({
      tool: "jp_lit_record_ndl_browser_search",
      cache_key: searchKey
    }).success).toBe(true);
    expect(candidateResultRefSchema.safeParse({
      tool: "jp_lit_get_record",
      cache_key: searchKey
    }).success).toBe(false);
    expect(candidateResultRefSchema.safeParse({
      tool: "jp_lit_search",
      cache_key: searchKey,
      cookie: "not-allowed"
    }).success).toBe(false);
  });

  it("jp_lit_search の item を保ったまま候補の取得経路を付加する", () => {
    const normalized = normalizeCandidateResult(
      { tool: "jp_lit_search", cache_key: searchKey },
      {
        query: "普通選挙法",
        source: "ndl_digital",
        page: 1,
        limit: 50,
        total: 1,
        items: [searchItem]
      }
    );

    expect(normalized).toMatchObject({
      ref: { tool: "jp_lit_search", cache_key: searchKey },
      query: "普通選挙法",
      total: 1,
      source: "ndl_digital",
      items: [{
        title: "帝国憲法大要（NDL Search）",
        source_metadata: {
          provider_id: "ndl-dl",
          candidate_origins: ["jp_lit_search"]
        }
      }]
    });
  });

  it("jp_lit_search_fulltext を canonical な NDL Digital item に変換する", () => {
    const normalized = normalizeCandidateResult(
      { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
      fulltextPayload
    );

    expect(normalized).toMatchObject({
      ref: { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
      query: "普通選挙法",
      total: 1,
      source: "ndl_digital",
      items: [{
        source: "ndl_digital",
        source_id: "R100000039-I1907653",
        title: "帝国憲法大要",
        authors: [{ name: "斉藤隆夫 著", role: null }],
        issued_at: "1926",
        issued_at_label: "1926",
        issued_at_precision: "year",
        source_metadata: {
          pid: "1907653",
          candidate_origins: ["next_digital_library_fulltext"],
          next_digital_library_fulltext: {
            viewer_url: "https://dl.ndl.go.jp/pid/1907653",
            volume: null,
            responsibility: "斉藤隆夫 著",
            published: "大正15",
            publishyear: 1926,
            ndc: "323",
            bib_id: "000000000001",
            call_no: "特1-1",
            page_count: 123,
            is_classic: false,
            highlights: ["普通選挙法"]
          }
        }
      }]
    });
  });

  it("壊れた candidate cache payload を明示エラーにする", () => {
    expect(() => normalizeCandidateResult(
      { tool: "jp_lit_search_fulltext", cache_key: fulltextKey },
      { keyword: "壊れたpayload", items: "not-an-array" }
    )).toThrow(
      `invalid candidate cache payload: jp_lit_search_fulltext/${fulltextKey}`
    );
  });

  it("存在しない candidate result ref を明示的な not-found にする", async () => {
    const cache = createFileCache(await createTempDir());

    await expect(readCandidateResult(cache, {
      tool: "jp_lit_search_fulltext",
      cache_key: fulltextKey
    })).rejects.toMatchObject({
      name: "NotFoundError",
      message: `candidate result cache not found: jp_lit_search_fulltext/${fulltextKey}`
    });
  });

  it("candidate-producing tool の envelope だけから共通 item を抽出する", () => {
    const candidateEnvelope = {
      version: 1,
      tool: "jp_lit_search",
      cache_key: searchKey,
      saved_at: "2026-09-05T00:00:00.000Z",
      input: { query: "普通選挙法" },
      structured_content: {
        query: "普通選挙法",
        source: "ndl_digital",
        page: 1,
        limit: 50,
        total: 1,
        items: [searchItem]
      }
    };

    expect(extractCandidateItems(candidateEnvelope)).toMatchObject([{
      source_id: "R100000039-I1907653",
      source_metadata: {
        candidate_origins: ["jp_lit_search"]
      }
    }]);
    expect(extractCandidateItems({
      ...candidateEnvelope,
      tool: "jp_lit_get_record"
    })).toBeNull();
  });

  it("browser result 用 cache namespace を専用 output schema で保存・再読する", async () => {
    const cache = createFileCache(await createTempDir());
    await cache.write("jp_lit_record_ndl_browser_search", {
      version: 1,
      tool: "jp_lit_record_ndl_browser_search",
      cache_key: searchKey,
      saved_at: "2026-09-05T03:00:00.000Z",
      input: { query: "普通選挙法" },
      structured_content: browserOutputPayload
    });

    await expect(readCandidateResult(cache, {
      tool: "jp_lit_record_ndl_browser_search",
      cache_key: searchKey
    })).resolves.toMatchObject({
      query: "普通選挙法",
      source: "ndl_digital",
      items: [{
        source_id: "R100000039-I1907653",
        source_metadata: {
          candidate_origins: ["ndl_digital_browser"],
          browser_observations: [browserObservation]
        }
      }]
    });
  });

  it("browser cache payload の未知 field を専用 output schema で拒否する", () => {
    expect(() => normalizeCandidateResult(
      { tool: "jp_lit_record_ndl_browser_search", cache_key: searchKey },
      { ...browserOutputPayload, cookie: "secret" }
    )).toThrow(
      `invalid candidate cache payload: jp_lit_record_ndl_browser_search/${searchKey}`
    );

    expect(() => normalizeCandidateResult(
      { tool: "jp_lit_record_ndl_browser_search", cache_key: searchKey },
      {
        ...browserOutputPayload,
        items: [{
          ...browserItem,
          source_metadata: {
            ...browserItem.source_metadata,
            pdf_path: "C:\\secret.pdf"
          }
        }]
      }
    )).toThrow(
      `invalid candidate cache payload: jp_lit_record_ndl_browser_search/${searchKey}`
    );
  });

  it("同一 source record を tool 優先度と安定した union 規則で統合する", () => {
    const apiItem = {
      ...searchItem,
      title: "帝国憲法大要（正式書誌）",
      publisher: "憲政公論社（正式）",
      subjects: ["ＮＤＣ３２３"],
      table_of_contents: ["第一章"],
      source_metadata: {
        provider_id: "ndl-dl",
        candidate_origins: ["jp_lit_search"]
      }
    };
    const mergeBrowserItem = {
      ...browserItem,
      summary: "ブラウザで確認した概要",
      authors: [{ name: "斉藤隆夫", role: "author" }],
      subjects: ["NDC323", "選挙法"],
      availability: { online: true, digital_collection: false },
      source_metadata: {
        ...browserItem.source_metadata,
        browser_observations: [
          browserObservation,
          olderBrowserObservation,
          reorderedOlderBrowserObservation
        ]
      }
    };
    const fulltextItem = {
      ...searchItem,
      title: "帝国憲法大要（全文検索）",
      subtitle: "第一巻",
      authors: [{ name: "斉藤隆夫 著", role: null }],
      publisher: "憲政公論社（全文検索）",
      subjects: ["選挙法", "政治"],
      table_of_contents: ["第一章", "第二章"],
      availability: { online: false, digital_collection: true },
      source_metadata: {
        pid: "1907653",
        candidate_origins: ["next_digital_library_fulltext"],
        next_digital_library_fulltext: {
          highlights: ["普通選挙法"]
        }
      }
    };
    const entries = [
      { tool: "jp_lit_search_fulltext" as const, item: fulltextItem },
      {
        tool: "jp_lit_record_ndl_browser_search" as const,
        item: mergeBrowserItem
      },
      { tool: "jp_lit_search" as const, item: apiItem }
    ];

    const merged = mergeSameSourceRecordItems(entries);
    const mergedInReverse = mergeSameSourceRecordItems([...entries].reverse());

    expect(mergedInReverse).toEqual(merged);
    expect(merged).toMatchObject({
      title: "帝国憲法大要（正式書誌）",
      subtitle: "第一巻",
      publisher: "憲政公論社（正式）",
      summary: "ブラウザで確認した概要",
      authors: [
        { name: "斉藤隆夫", role: "author" },
        { name: "斉藤隆夫 著", role: null }
      ],
      availability: {
        online: true,
        digital_collection: true
      },
      subjects: ["ＮＤＣ３２３", "選挙法", "政治"],
      table_of_contents: ["第一章", "第二章"],
      source_metadata: {
        provider_id: "ndl-dl",
        candidate_origins: [
          "jp_lit_search",
          "ndl_digital_browser",
          "next_digital_library_fulltext"
        ],
        next_digital_library_fulltext: {
          highlights: ["普通選挙法"]
        }
      }
    });
    expect(merged.source_metadata?.browser_observations).toEqual([
      olderBrowserObservation,
      browserObservation
    ]);
  });

  it("日付組は issued_at の有無より tool 優先度順の最初の内容を採用する", () => {
    const apiItem = {
      ...searchItem,
      issued_at: null,
      issued_at_label: "大正15",
      issued_at_precision: "unknown" as const
    };
    const fulltextItem = {
      ...searchItem,
      issued_at: "1926",
      issued_at_label: "1926",
      issued_at_precision: "year" as const
    };

    const merged = mergeSameSourceRecordItems([
      { tool: "jp_lit_search_fulltext", item: fulltextItem },
      { tool: "jp_lit_search", item: apiItem }
    ]);

    expect(merged).toMatchObject({
      issued_at: null,
      issued_at_label: "大正15",
      issued_at_precision: "unknown"
    });
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "]
  ])("上位の日付 label が%sなら下位の有効な日付組を採用する", (_case, label) => {
    const apiItem = {
      ...searchItem,
      issued_at: null,
      issued_at_label: label,
      issued_at_precision: "unknown" as const
    };
    const fulltextItem = {
      ...searchItem,
      issued_at: "1926",
      issued_at_label: "1926",
      issued_at_precision: "year" as const
    };

    const merged = mergeSameSourceRecordItems([
      { tool: "jp_lit_search_fulltext", item: fulltextItem },
      { tool: "jp_lit_search", item: apiItem }
    ]);

    expect(merged).toMatchObject({
      issued_at: "1926",
      issued_at_label: "1926",
      issued_at_precision: "year"
    });
  });
});
