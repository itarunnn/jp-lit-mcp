import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readCandidateResult } from "../src/lib/candidateResultAdapters.js";
import { createFileCache } from "../src/lib/persistence/fileCache.js";
import { createSessionStore } from "../src/lib/persistence/sessionStore.js";
import {
  recordNdlBrowserSearchInputSchema,
  recordNdlBrowserSearchOutputSchema
} from "../src/lib/schemas.js";
import { createJpLitRecordNdlBrowserSearchTool } from "../src/tools/jpLitRecordNdlBrowserSearch.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jp-lit-ndl-browser-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

const OBSERVATION = {
  query: "普通選挙法",
  checked_at: "2026-09-05T12:00:00+09:00",
  login_state: "logged_in_existing_session",
  page: 1,
  reported_total: 1,
  total_relation: "reported_exact",
  filters: {
    access_scopes: ["transmission"],
    material_types: ["図書"],
    raw_labels: ["送信サービスで閲覧可能"]
  },
  items: [{
    pid: "1907653",
    title: "帝国憲法大要",
    volume: null,
    authors: ["斉藤隆夫"],
    publisher: "憲政公論社",
    published: "1926",
    viewer_url: "https://dl.ndl.go.jp/pid/1907653",
    access_scope: "individual_transmission",
    access_label: "個人送信で閲覧可能",
    snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
    item_fulltext_state: "searched",
    hit_locations: ["67–73コマ"],
    content_state: "page_image_checked",
    print_file_state: "dialog_available"
  }]
} as const;

const OUTPUT = {
  query: "普通選挙法",
  source: "ndl_digital",
  page: 1,
  limit: 100,
  total: 1,
  items: [{
    source: "ndl_digital",
    source_id: "R100000039-I1907653",
    title: "帝国憲法大要",
    subtitle: null,
    title_reading: null,
    authors: [{ name: "斉藤隆夫", role: null }],
    publisher: "憲政公論社",
    journal_title: null,
    issued_at: "1926",
    issued_at_label: "1926",
    issued_at_precision: "year",
    summary: null,
    url: "https://dl.ndl.go.jp/pid/1907653",
    availability: { online: true, digital_collection: true },
    material_type: null,
    subjects: [],
    table_of_contents: [],
    source_metadata: {
      pid: "1907653",
      candidate_origins: ["ndl_digital_browser"],
      browser_observations: [{
        checked_at: "2026-09-05T12:00:00+09:00",
        login_state: "logged_in_existing_session",
        query: "普通選挙法",
        access_scope: "individual_transmission",
        access_label: "個人送信で閲覧可能",
        snippets: [{ text: "普通選挙法", locator_type: "koma", locator: "67" }],
        item_fulltext_state: "searched",
        hit_locations: ["67–73コマ"],
        content_state: "page_image_checked",
        print_file_state: "dialog_available"
      }]
    },
    duplicate_key: null,
    duplicate_count: 1,
    related_records: []
  }],
  observation: {
    method: "browser",
    service: "ndl_digital_collections",
    checked_at: "2026-09-05T12:00:00+09:00",
    login_state: "logged_in_existing_session",
    reported_total: 1,
    total_relation: "reported_exact",
    observed_count: 1,
    filters: {
      access_scopes: ["transmission"],
      material_types: ["図書"],
      raw_labels: ["送信サービスで閲覧可能"]
    }
  }
} as const;

function mutableObservation(): Record<string, unknown> {
  return structuredClone(OBSERVATION) as unknown as Record<string, unknown>;
}

describe("recordNdlBrowserSearchInputSchema", () => {
  it("ログイン済み browser smoke の観測記録を受理する", () => {
    expect(recordNdlBrowserSearchInputSchema.safeParse({
      session_id: "2026-09-05-120000-0123abcd",
      ...OBSERVATION
    }).success).toBe(true);
  });

  it.each([
    ["http URL", (input: any) => { input.items[0].viewer_url = "http://dl.ndl.go.jp/pid/1907653"; }],
    ["別 host", (input: any) => { input.items[0].viewer_url = "https://example.com/pid/1907653"; }],
    ["credential 付き URL", (input: any) => { input.items[0].viewer_url = "https://user:password@dl.ndl.go.jp/pid/1907653"; }],
    ["URL と PID の不一致", (input: any) => { input.items[0].viewer_url = "https://dl.ndl.go.jp/pid/9999999"; }],
    ["101 items", (input: any) => { input.items = Array.from({ length: 101 }, () => structuredClone(input.items[0])); }],
    ["6 snippets", (input: any) => { input.items[0].snippets = Array.from({ length: 6 }, () => ({ text: "hit", locator_type: "koma", locator: "1" })); }],
    ["501文字 snippet", (input: any) => { input.items[0].snippets[0].text = "あ".repeat(501); }],
    ["21 hit locations", (input: any) => { input.items[0].hit_locations = Array.from({ length: 21 }, (_, index) => `${index + 1}コマ`); }],
    ["121文字 location", (input: any) => { input.items[0].hit_locations[0] = "あ".repeat(121); }],
    ["未知 field cookie", (input: any) => { input.cookie = "secret"; }],
    ["filters 内の未知 field cookie", (input: any) => { input.filters.cookie = "secret"; }],
    ["item 内の未知 field cookie", (input: any) => { input.items[0].cookie = "secret"; }],
    ["snippet 内の未知 field cookie", (input: any) => { input.items[0].snippets[0].cookie = "secret"; }],
    ["reported_total が items.length 未満", (input: any) => { input.reported_total = 0; }],
    ["reported_total=null と exact", (input: any) => { input.reported_total = null; }],
    ["reported_total 非 null と observed_lower_bound", (input: any) => { input.total_relation = "observed_lower_bound"; }],
    ["offset のない checked_at", (input: any) => { input.checked_at = "2026-09-05T12:00:00"; }],
    ["実在しない checked_at", (input: any) => { input.checked_at = "2026-09-31T12:00:00+09:00"; }]
  ])("%s を拒否する", (_label, mutate) => {
    const input = mutableObservation();
    mutate(input);

    expect(recordNdlBrowserSearchInputSchema.safeParse({
      session_id: "2026-09-05-120000-0123abcd",
      ...input
    }).success).toBe(false);
  });

  it("総件数が読めない観測は observed_lower_bound と item 数を受理する", () => {
    expect(recordNdlBrowserSearchInputSchema.safeParse({
      session_id: "2026-09-05-120000-0123abcd",
      ...OBSERVATION,
      reported_total: null,
      total_relation: "observed_lower_bound"
    }).success).toBe(true);
  });
});

describe("recordNdlBrowserSearchOutputSchema", () => {
  it("browser 観測 provenance 付きの SearchItem output を受理する", () => {
    expect(recordNdlBrowserSearchOutputSchema.safeParse(OUTPUT).success).toBe(true);
  });

  it("output と browser source_metadata の未知 field を拒否する", () => {
    const topLevel = structuredClone(OUTPUT) as any;
    topLevel.cookie = "secret";
    const metadata = structuredClone(OUTPUT) as any;
    metadata.items[0].source_metadata.pdf_path = "C:\\secret.pdf";

    expect(recordNdlBrowserSearchOutputSchema.safeParse(topLevel).success).toBe(false);
    expect(recordNdlBrowserSearchOutputSchema.safeParse(metadata).success).toBe(false);
  });
});

describe("jp_lit_record_ndl_browser_search", () => {
  it("同一観測を cache に保存・再利用し、各呼び出しを session に記録する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const session = await sessions.startSession({ research_goal: "普通選挙法" });
    const tool = createJpLitRecordNdlBrowserSearchTool(cache, sessions);

    const first = await tool({ session_id: session.session_id, ...OBSERVATION });
    const second = await tool({ session_id: session.session_id, ...OBSERVATION });

    expect(first.structuredContent.cache).toMatchObject({
      hit: false,
      cache_key: expect.any(String),
      saved_at: expect.any(String),
      refresh_hint: null
    });
    expect(second.structuredContent.cache).toMatchObject({
      hit: true,
      cache_key: first.structuredContent.cache.cache_key,
      saved_at: first.structuredContent.cache.saved_at,
      refresh_hint: "同一観測の保存済み結果。再確認した場合は新しい checked_at で記録する"
    });
    expect(second.structuredContent.cache.refresh_hint).not.toMatch(/upstream|上流API|force_refresh/);

    const storedSession = await sessions.readById(session.session_id);
    expect(storedSession.entries).toHaveLength(2);
    expect(storedSession.entries).toEqual([
      expect.objectContaining({
        tool: "jp_lit_record_ndl_browser_search",
        cache_key: first.structuredContent.cache.cache_key,
        result_ref: {
          tool: "jp_lit_record_ndl_browser_search",
          cache_key: first.structuredContent.cache.cache_key
        }
      }),
      expect.objectContaining({
        tool: "jp_lit_record_ndl_browser_search",
        cache_key: first.structuredContent.cache.cache_key,
        result_ref: {
          tool: "jp_lit_record_ndl_browser_search",
          cache_key: first.structuredContent.cache.cache_key
        }
      })
    ]);
  });

  it("観測全体を cache identity と payload に使い、session_id だけを除外する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const session = await sessions.startSession({ research_goal: "cache identity" });
    const tool = createJpLitRecordNdlBrowserSearchTool(cache, sessions);

    const first = await tool({ session_id: session.session_id, ...OBSERVATION });
    const later = await tool({
      session_id: session.session_id,
      ...OBSERVATION,
      checked_at: "2026-09-05T12:01:00+09:00"
    });
    const stored = await cache.read(
      "jp_lit_record_ndl_browser_search",
      first.structuredContent.cache.cache_key
    );

    expect(stored?.input).toEqual(OBSERVATION);
    expect(stored?.input).not.toHaveProperty("session_id");
    expect(later.structuredContent.cache.hit).toBe(false);
    expect(later.structuredContent.cache.cache_key).not.toBe(
      first.structuredContent.cache.cache_key
    );
  });

  it("browser item を canonical NDL Digital SearchItem と provenance に写像する", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const session = await sessions.startSession({ research_goal: "mapping" });
    const tool = createJpLitRecordNdlBrowserSearchTool(cache, sessions);

    const result = await tool({ session_id: session.session_id, ...OBSERVATION });

    expect(result.structuredContent).toMatchObject({
      query: "普通選挙法",
      source: "ndl_digital",
      page: 1,
      limit: 100,
      total: 1,
      items: [{
        source: "ndl_digital",
        source_id: "R100000039-I1907653",
        title: "帝国憲法大要",
        subtitle: null,
        authors: [{ name: "斉藤隆夫", role: null }],
        publisher: "憲政公論社",
        issued_at: "1926",
        issued_at_label: "1926",
        issued_at_precision: "year",
        url: "https://dl.ndl.go.jp/pid/1907653",
        availability: { online: true, digital_collection: true },
        source_metadata: {
          pid: "1907653",
          candidate_origins: ["ndl_digital_browser"],
          browser_observations: [OUTPUT.items[0].source_metadata.browser_observations[0]]
        }
      }],
      observation: OUTPUT.observation
    });
    expect(recordNdlBrowserSearchOutputSchema.safeParse(result.structuredContent).success).toBe(true);

    await expect(readCandidateResult(cache, {
      tool: "jp_lit_record_ndl_browser_search",
      cache_key: result.structuredContent.cache.cache_key
    })).resolves.toMatchObject({
      query: "普通選挙法",
      source: "ndl_digital",
      items: [{
        source_id: "R100000039-I1907653",
        source_metadata: {
          candidate_origins: ["ndl_digital_browser"],
          browser_observations: [OUTPUT.items[0].source_metadata.browser_observations[0]]
        }
      }]
    });
  });

  it("reported_total が未観測なら item 数を lower bound の total にする", async () => {
    const baseDir = await createTempDir();
    const cache = createFileCache(baseDir);
    const sessions = createSessionStore(baseDir);
    const session = await sessions.startSession({ research_goal: "lower bound" });
    const tool = createJpLitRecordNdlBrowserSearchTool(cache, sessions);

    const result = await tool({
      session_id: session.session_id,
      ...OBSERVATION,
      reported_total: null,
      total_relation: "observed_lower_bound"
    });

    expect(result.structuredContent.total).toBe(1);
    expect(result.structuredContent.observation).toMatchObject({
      reported_total: null,
      total_relation: "observed_lower_bound",
      observed_count: 1
    });
  });
});
