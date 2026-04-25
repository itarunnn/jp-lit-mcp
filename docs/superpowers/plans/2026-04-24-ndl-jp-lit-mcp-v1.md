# NDL JP Literature MCP v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NDL Search と NDLデジタルコレクションを対象に、検索と詳細取得を提供する日本語文献探索向け MCP サーバー v1 を構築する。

**Architecture:** Node.js/TypeScript で MCP サーバーを実装し、外向きには `jp_lit_search` と `jp_lit_get_record` の2ツールだけを公開する。内部は `tool -> service -> source adapter` の3層に分け、NDL Search と NDLデジタルコレクションのレスポンスを共通スキーマへ正規化する。

**Tech Stack:** Node.js, TypeScript, MCP SDK, Zod, Vitest, tsx

---

## 想定ファイル構成

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src/index.ts`
- Create: `src/server.ts`
- Create: `src/tools/jpLitSearch.ts`
- Create: `src/tools/jpLitGetRecord.ts`
- Create: `src/lib/types.ts`
- Create: `src/lib/schemas.ts`
- Create: `src/lib/errors.ts`
- Create: `src/lib/http.ts`
- Create: `src/lib/date.ts`
- Create: `src/lib/normalize.ts`
- Create: `src/services/sourceRegistry.ts`
- Create: `src/services/searchService.ts`
- Create: `src/services/recordService.ts`
- Create: `src/sources/types.ts`
- Create: `src/sources/ndlSearch/adapter.ts`
- Create: `src/sources/ndlSearch/mapSearch.ts`
- Create: `src/sources/ndlSearch/mapRecord.ts`
- Create: `src/sources/ndlDigital/adapter.ts`
- Create: `src/sources/ndlDigital/mapSearch.ts`
- Create: `src/sources/ndlDigital/mapRecord.ts`
- Create: `tests/date.test.ts`
- Create: `tests/sourceRegistry.test.ts`
- Create: `tests/jpLitSearch.test.ts`
- Create: `tests/jpLitGetRecord.test.ts`
- Create: `tests/ndlSearch.adapter.test.ts`
- Create: `tests/ndlDigital.adapter.test.ts`
- Create: `tests/fixtures/ndl-search/search-response.json`
- Create: `tests/fixtures/ndl-search/record-response.json`
- Create: `tests/fixtures/ndl-digital/search-response.json`
- Create: `tests/fixtures/ndl-digital/record-response.json`
- Create: `docs/api-notes/ndl-search.md`
- Create: `docs/api-notes/ndl-digital.md`

### Task 1: プロジェクトの土台を作る

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: package.json の失敗しない最小要件を先に定義する**

```json
{
  "name": "ndl-jp-lit-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "NDL Search and NDL Digital Collections MCP server for Japanese literature research",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: TypeScript 設定を追加する**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Git 管理外ファイルを定義する**

```gitignore
node_modules/
dist/
.env
coverage/
```

- [ ] **Step 4: README に最小の起動手順だけ書く**

```md
# ndl-jp-lit-mcp

NDL Search と NDLデジタルコレクションを対象にした日本語文献探索向け MCP サーバー。

## 開発

```bash
npm install
npm test
npm run dev
```
```

- [ ] **Step 5: 依存をインストールして package 解決が通ることを確認する**

Run: `npm install`  
Expected: `added ... packages` が表示され、`package-lock.json` が生成される

- [ ] **Step 6: 初期状態をコミットする**

```bash
git init
git add package.json package-lock.json tsconfig.json .gitignore README.md
git commit -m "chore: initialize TypeScript MCP project"
```

### Task 2: 共通型と日付正規化の土台を TDD で作る

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/date.ts`
- Create: `src/lib/normalize.ts`
- Test: `tests/date.test.ts`

- [ ] **Step 1: 日付正規化テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { normalizeIssuedAt } from "../src/lib/date.js";

describe("normalizeIssuedAt", () => {
  it("exact ISO date を day 精度で返す", () => {
    expect(normalizeIssuedAt("1905-04-01")).toEqual({
      issuedAt: "1905-04-01",
      issuedAtLabel: "1905-04-01",
      issuedAtPrecision: "day"
    });
  });

  it("year-month を month 精度で返す", () => {
    expect(normalizeIssuedAt("1934.5")).toEqual({
      issuedAt: "1934-05",
      issuedAtLabel: "1934.5",
      issuedAtPrecision: "month"
    });
  });

  it("year only を year 精度で返す", () => {
    expect(normalizeIssuedAt("1905")).toEqual({
      issuedAt: "1905",
      issuedAtLabel: "1905",
      issuedAtPrecision: "year"
    });
  });

  it("曖昧な和暦は unknown 扱いにする", () => {
    expect(normalizeIssuedAt("昭和初期")).toEqual({
      issuedAt: null,
      issuedAtLabel: "昭和初期",
      issuedAtPrecision: "unknown"
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- tests/date.test.ts`  
Expected: FAIL with `Cannot find module '../src/lib/date.js'`

- [ ] **Step 3: 共通型を定義する**

```ts
export type SourceName = "ndl_search" | "ndl_digital";

export type IssuedAtPrecision = "day" | "month" | "year" | "unknown";

export interface DateInfo {
  issuedAt: string | null;
  issuedAtLabel: string | null;
  issuedAtPrecision: IssuedAtPrecision;
}

export interface PersonRole {
  name: string;
  role: string | null;
}

export interface SearchItem {
  source: SourceName;
  source_id: string;
  title: string;
  subtitle: string | null;
  authors: PersonRole[];
  publisher: string | null;
  issued_at: string | null;
  issued_at_label: string | null;
  issued_at_precision: IssuedAtPrecision;
  summary: string | null;
  url: string | null;
  availability: {
    online: boolean;
    digital_collection: boolean;
  };
}

export interface RecordItem extends SearchItem {
  alternative_titles: string[];
  publication_place: string | null;
  language: string | null;
  material_type: string | null;
  extent: string | null;
  subjects: string[];
  identifiers: Record<string, unknown>;
  table_of_contents: string[];
  content_access: {
    has_page_images: boolean;
    has_text_coordinates: boolean;
    viewer_url: string | null;
    access_note: string | null;
  };
  source_metadata: Record<string, unknown>;
  raw: Record<string, unknown>;
}
```

- [ ] **Step 4: 最小の日付正規化実装を書く**

```ts
import type { DateInfo } from "./types.js";

const YEAR_ONLY = /^(\d{4})$/;
const YEAR_MONTH = /^(\d{4})[./-](\d{1,2})$/;
const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeIssuedAt(input: string | null | undefined): DateInfo {
  const value = input?.trim() ?? "";

  if (!value) {
    return {
      issuedAt: null,
      issuedAtLabel: null,
      issuedAtPrecision: "unknown"
    };
  }

  if (FULL_DATE.test(value)) {
    return {
      issuedAt: value,
      issuedAtLabel: value,
      issuedAtPrecision: "day"
    };
  }

  const monthMatch = value.match(YEAR_MONTH);
  if (monthMatch) {
    return {
      issuedAt: `${monthMatch[1]}-${monthMatch[2].padStart(2, "0")}`,
      issuedAtLabel: value,
      issuedAtPrecision: "month"
    };
  }

  if (YEAR_ONLY.test(value)) {
    return {
      issuedAt: value,
      issuedAtLabel: value,
      issuedAtPrecision: "year"
    };
  }

  return {
    issuedAt: null,
    issuedAtLabel: value,
    issuedAtPrecision: "unknown"
  };
}
```

- [ ] **Step 5: snake_case 変換などの軽量ヘルパーを追加する**

```ts
export function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim() ?? "").filter(Boolean);
}
```

- [ ] **Step 6: テストを再実行して通す**

Run: `npm test -- tests/date.test.ts`  
Expected: PASS

- [ ] **Step 7: 日付基盤をコミットする**

```bash
git add src/lib/types.ts src/lib/date.ts src/lib/normalize.ts tests/date.test.ts
git commit -m "feat: add shared types and date normalization"
```

### Task 3: source registry と adapter interface を作る

**Files:**
- Create: `src/sources/types.ts`
- Create: `src/services/sourceRegistry.ts`
- Test: `tests/sourceRegistry.test.ts`

- [ ] **Step 1: registry の振る舞いを固定するテストを書く**

```ts
import { describe, expect, it } from "vitest";
import { createSourceRegistry } from "../src/services/sourceRegistry.js";
import type { SourceAdapter } from "../src/sources/types.js";

const dummyAdapter: SourceAdapter = {
  source: "ndl_search",
  search: async () => ({ total: 0, items: [] }),
  getRecord: async () => null
};

describe("createSourceRegistry", () => {
  it("source 名から adapter を引ける", () => {
    const registry = createSourceRegistry([dummyAdapter]);
    expect(registry.get("ndl_search")).toBe(dummyAdapter);
  });

  it("未対応 source で例外を投げる", () => {
    const registry = createSourceRegistry([dummyAdapter]);
    expect(() => registry.get("ndl_digital")).toThrow("Unsupported source");
  });
});
```

- [ ] **Step 2: テスト失敗を確認する**

Run: `npm test -- tests/sourceRegistry.test.ts`  
Expected: FAIL with `Cannot find module '../src/services/sourceRegistry.js'`

- [ ] **Step 3: adapter interface を定義する**

```ts
import type { RecordItem, SearchItem, SourceName } from "../lib/types.js";

export interface SearchParams {
  query: string;
  limit: number;
  page: number;
}

export interface SearchResult {
  total: number;
  items: SearchItem[];
}

export interface SourceAdapter {
  source: SourceName;
  search(params: SearchParams): Promise<SearchResult>;
  getRecord(sourceId: string): Promise<RecordItem | null>;
}
```

- [ ] **Step 4: registry 実装を書く**

```ts
import type { SourceName } from "../lib/types.js";
import type { SourceAdapter } from "../sources/types.js";

export function createSourceRegistry(adapters: SourceAdapter[]) {
  const map = new Map<SourceName, SourceAdapter>(
    adapters.map((adapter) => [adapter.source, adapter])
  );

  return {
    get(source: SourceName): SourceAdapter {
      const adapter = map.get(source);
      if (!adapter) {
        throw new Error(`Unsupported source: ${source}`);
      }

      return adapter;
    },
    list(): SourceName[] {
      return [...map.keys()];
    }
  };
}
```

- [ ] **Step 5: テストを再実行して通す**

Run: `npm test -- tests/sourceRegistry.test.ts`  
Expected: PASS

- [ ] **Step 6: registry をコミットする**

```bash
git add src/sources/types.ts src/services/sourceRegistry.ts tests/sourceRegistry.test.ts
git commit -m "feat: add source registry and adapter contracts"
```

### Task 4: search/record service を実装する

**Files:**
- Create: `src/lib/errors.ts`
- Create: `src/services/searchService.ts`
- Create: `src/services/recordService.ts`
- Modify: `src/services/sourceRegistry.ts`
- Test: `tests/jpLitSearch.test.ts`
- Test: `tests/jpLitGetRecord.test.ts`

- [ ] **Step 1: search service のテストを書く**

```ts
import { describe, expect, it } from "vitest";
import { createSearchService } from "../src/services/searchService.js";
import type { SourceAdapter } from "../src/sources/types.js";

const adapter: SourceAdapter = {
  source: "ndl_search",
  search: async () => ({
    total: 1,
    items: [
      {
        source: "ndl_search",
        source_id: "1",
        title: "吾輩は猫である",
        subtitle: null,
        authors: [],
        publisher: null,
        issued_at: "1905",
        issued_at_label: "1905",
        issued_at_precision: "year",
        summary: null,
        url: null,
        availability: { online: false, digital_collection: true }
      }
    ]
  }),
  getRecord: async () => null
};

describe("createSearchService", () => {
  it("source 指定ありで単一 source 検索を返す", async () => {
    const service = createSearchService([adapter]);
    const result = await service.search({ query: "夏目漱石", source: "ndl_search", limit: 10, page: 1 });
    expect(result.total).toBe(1);
  });
});
```

- [ ] **Step 2: record service のテストを書く**

```ts
import { describe, expect, it } from "vitest";
import { createRecordService } from "../src/services/recordService.js";
import type { SourceAdapter } from "../src/sources/types.js";

const adapter: SourceAdapter = {
  source: "ndl_digital",
  search: async () => ({ total: 0, items: [] }),
  getRecord: async (sourceId) => ({
    source: "ndl_digital",
    source_id: sourceId,
    title: "吾輩は猫である",
    subtitle: null,
    authors: [],
    publisher: null,
    issued_at: "1905",
    issued_at_label: "1905",
    issued_at_precision: "year",
    summary: null,
    url: null,
    availability: { online: true, digital_collection: true },
    alternative_titles: [],
    publication_place: null,
    language: "jpn",
    material_type: "book",
    extent: null,
    subjects: [],
    identifiers: {},
    table_of_contents: [],
    content_access: {
      has_page_images: true,
      has_text_coordinates: false,
      viewer_url: null,
      access_note: null
    },
    source_metadata: {},
    raw: {}
  })
};

describe("createRecordService", () => {
  it("source と source_id から詳細を返す", async () => {
    const service = createRecordService([adapter]);
    const result = await service.getRecord({ source: "ndl_digital", sourceId: "abc" });
    expect(result?.source_id).toBe("abc");
  });
});
```

- [ ] **Step 3: テスト失敗を確認する**

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts`  
Expected: FAIL with missing service modules

- [ ] **Step 4: 共通エラー型を定義する**

```ts
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
```

- [ ] **Step 5: search service を実装する**

```ts
import type { SourceName } from "../lib/types.js";
import { createSourceRegistry } from "./sourceRegistry.js";
import type { SourceAdapter } from "../sources/types.js";

interface SearchInput {
  query: string;
  source?: SourceName;
  limit: number;
  page: number;
}

export function createSearchService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async search(input: SearchInput) {
      if (input.source) {
        return registry.get(input.source).search(input);
      }

      const results = await Promise.all(
        registry.list().map((source) => registry.get(source).search(input))
      );

      return {
        total: results.reduce((sum, result) => sum + result.total, 0),
        items: results.flatMap((result) => result.items).slice(0, input.limit)
      };
    }
  };
}
```

- [ ] **Step 6: record service を実装する**

```ts
import { NotFoundError } from "../lib/errors.js";
import { createSourceRegistry } from "./sourceRegistry.js";
import type { SourceAdapter } from "../sources/types.js";
import type { SourceName } from "../lib/types.js";

interface RecordInput {
  source: SourceName;
  sourceId: string;
}

export function createRecordService(adapters: SourceAdapter[]) {
  const registry = createSourceRegistry(adapters);

  return {
    async getRecord(input: RecordInput) {
      const record = await registry.get(input.source).getRecord(input.sourceId);

      if (!record) {
        throw new NotFoundError(`Record not found: ${input.source}/${input.sourceId}`);
      }

      return record;
    }
  };
}
```

- [ ] **Step 7: テストを再実行して通す**

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts`  
Expected: PASS

- [ ] **Step 8: service 層をコミットする**

```bash
git add src/lib/errors.ts src/services/searchService.ts src/services/recordService.ts tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts
git commit -m "feat: add search and record services"
```

### Task 5: NDL Search adapter を実装する

**Files:**
- Create: `src/lib/http.ts`
- Create: `src/sources/ndlSearch/adapter.ts`
- Create: `src/sources/ndlSearch/mapSearch.ts`
- Create: `src/sources/ndlSearch/mapRecord.ts`
- Create: `tests/fixtures/ndl-search/search-response.json`
- Create: `tests/fixtures/ndl-search/record-response.json`
- Test: `tests/ndlSearch.adapter.test.ts`
- Create: `docs/api-notes/ndl-search.md`

- [ ] **Step 1: fixture ベースの adapter テストを書く**

```ts
import { describe, expect, it } from "vitest";
import searchFixture from "./fixtures/ndl-search/search-response.json";
import recordFixture from "./fixtures/ndl-search/record-response.json";
import { mapNdlSearchSearchResponse } from "../src/sources/ndlSearch/mapSearch.js";
import { mapNdlSearchRecordResponse } from "../src/sources/ndlSearch/mapRecord.js";

describe("NDL Search mappers", () => {
  it("検索結果を共通 SearchItem に正規化する", () => {
    const result = mapNdlSearchSearchResponse(searchFixture);
    expect(result.items[0].source).toBe("ndl_search");
    expect(result.items[0].source_id).toBeTruthy();
  });

  it("詳細結果を共通 RecordItem に正規化する", () => {
    const record = mapNdlSearchRecordResponse(recordFixture);
    expect(record.table_of_contents).toBeInstanceOf(Array);
    expect(record.issued_at_precision).toBeTruthy();
  });
});
```

- [ ] **Step 2: fixture を仮置きしてテスト失敗を確認する**

```json
{
  "title": "replace with real fixture"
}
```

Run: `npm test -- tests/ndlSearch.adapter.test.ts`  
Expected: FAIL with missing mapper modules or assertion mismatch

- [ ] **Step 3: 軽量 HTTP ラッパーを書く**

```ts
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Upstream request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: 検索マッパーを書く**

```ts
import { normalizeIssuedAt } from "../../lib/date.js";
import type { SearchResult } from "../types.js";

export function mapNdlSearchSearchResponse(payload: any): SearchResult {
  const entries = Array.isArray(payload.items) ? payload.items : [];

  return {
    total: Number(payload.total ?? entries.length),
    items: entries.map((entry: any) => {
      const date = normalizeIssuedAt(entry.issued ?? null);

      return {
        source: "ndl_search",
        source_id: String(entry.id),
        title: entry.title ?? "Untitled",
        subtitle: entry.subtitle ?? null,
        authors: Array.isArray(entry.authors)
          ? entry.authors.map((name: string) => ({ name, role: "author" }))
          : [],
        publisher: entry.publisher ?? null,
        issued_at: date.issuedAt,
        issued_at_label: date.issuedAtLabel,
        issued_at_precision: date.issuedAtPrecision,
        summary: entry.summary ?? null,
        url: entry.url ?? null,
        availability: {
          online: Boolean(entry.online),
          digital_collection: Boolean(entry.digitalCollection)
        }
      };
    })
  };
}
```

- [ ] **Step 5: 詳細マッパーを書く**

```ts
import { normalizeIssuedAt } from "../../lib/date.js";

export function mapNdlSearchRecordResponse(entry: any) {
  const date = normalizeIssuedAt(entry.issued ?? null);

  return {
    source: "ndl_search",
    source_id: String(entry.id),
    title: entry.title ?? "Untitled",
    subtitle: entry.subtitle ?? null,
    authors: Array.isArray(entry.authors)
      ? entry.authors.map((name: string) => ({ name, role: "author" }))
      : [],
    publisher: entry.publisher ?? null,
    issued_at: date.issuedAt,
    issued_at_label: date.issuedAtLabel,
    issued_at_precision: date.issuedAtPrecision,
    summary: entry.summary ?? null,
    url: entry.url ?? null,
    availability: {
      online: Boolean(entry.online),
      digital_collection: Boolean(entry.digitalCollection)
    },
    alternative_titles: Array.isArray(entry.alternativeTitles) ? entry.alternativeTitles : [],
    publication_place: entry.publicationPlace ?? null,
    language: entry.language ?? null,
    material_type: entry.materialType ?? null,
    extent: entry.extent ?? null,
    subjects: Array.isArray(entry.subjects) ? entry.subjects : [],
    identifiers: entry.identifiers ?? {},
    table_of_contents: Array.isArray(entry.tableOfContents) ? entry.tableOfContents : [],
    content_access: {
      has_page_images: Boolean(entry.hasPageImages),
      has_text_coordinates: Boolean(entry.hasTextCoordinates),
      viewer_url: entry.viewerUrl ?? null,
      access_note: entry.accessNote ?? null
    },
    source_metadata: {
      provider: "National Diet Library",
      raw_url: entry.rawUrl ?? null
    },
    raw: entry
  };
}
```

- [ ] **Step 6: adapter 本体を書く**

```ts
import { fetchJson } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapNdlSearchRecordResponse } from "./mapRecord.js";
import { mapNdlSearchSearchResponse } from "./mapSearch.js";

export function createNdlSearchAdapter(baseUrl: string): SourceAdapter {
  return {
    source: "ndl_search",
    async search({ query, limit, page }) {
      const url = new URL("/search", baseUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("page", String(page));

      const payload = await fetchJson<any>(url.toString());
      return mapNdlSearchSearchResponse(payload);
    },
    async getRecord(sourceId) {
      const url = new URL(`/record/${sourceId}`, baseUrl);
      const payload = await fetchJson<any>(url.toString());
      return mapNdlSearchRecordResponse(payload);
    }
  };
}
```

- [ ] **Step 7: 実 API 仕様のメモを書く**

```md
# NDL Search API Notes

- 検索エンドポイント URL
- 詳細取得エンドポイント URL
- パラメータ名
- レスポンスで title / author / issued / toc がどこに入るか
- 利用条件メモ
```

- [ ] **Step 8: テストを再実行して通す**

Run: `npm test -- tests/ndlSearch.adapter.test.ts`  
Expected: PASS

- [ ] **Step 9: NDL Search adapter をコミットする**

```bash
git add src/lib/http.ts src/sources/ndlSearch tests/ndlSearch.adapter.test.ts tests/fixtures/ndl-search docs/api-notes/ndl-search.md
git commit -m "feat: add NDL Search adapter"
```

### Task 6: NDLデジタルコレクション adapter を実装する

**Files:**
- Create: `src/sources/ndlDigital/adapter.ts`
- Create: `src/sources/ndlDigital/mapSearch.ts`
- Create: `src/sources/ndlDigital/mapRecord.ts`
- Create: `tests/fixtures/ndl-digital/search-response.json`
- Create: `tests/fixtures/ndl-digital/record-response.json`
- Test: `tests/ndlDigital.adapter.test.ts`
- Create: `docs/api-notes/ndl-digital.md`

- [ ] **Step 1: fixture ベースの adapter テストを書く**

```ts
import { describe, expect, it } from "vitest";
import searchFixture from "./fixtures/ndl-digital/search-response.json";
import recordFixture from "./fixtures/ndl-digital/record-response.json";
import { mapNdlDigitalSearchResponse } from "../src/sources/ndlDigital/mapSearch.js";
import { mapNdlDigitalRecordResponse } from "../src/sources/ndlDigital/mapRecord.js";

describe("NDL Digital mappers", () => {
  it("検索結果を共通 SearchItem に正規化する", () => {
    const result = mapNdlDigitalSearchResponse(searchFixture);
    expect(result.items[0].source).toBe("ndl_digital");
  });

  it("詳細結果に content_access を含める", () => {
    const record = mapNdlDigitalRecordResponse(recordFixture);
    expect(record.content_access.has_page_images).toBeTypeOf("boolean");
    expect(record.table_of_contents).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: fixture を仮置きしてテスト失敗を確認する**

```json
{
  "title": "replace with real fixture"
}
```

Run: `npm test -- tests/ndlDigital.adapter.test.ts`  
Expected: FAIL with missing mapper modules or assertion mismatch

- [ ] **Step 3: 検索マッパーを書く**

```ts
import { normalizeIssuedAt } from "../../lib/date.js";
import type { SearchResult } from "../types.js";

export function mapNdlDigitalSearchResponse(payload: any): SearchResult {
  const entries = Array.isArray(payload.items) ? payload.items : [];

  return {
    total: Number(payload.total ?? entries.length),
    items: entries.map((entry: any) => {
      const date = normalizeIssuedAt(entry.issued ?? null);

      return {
        source: "ndl_digital",
        source_id: String(entry.id),
        title: entry.title ?? "Untitled",
        subtitle: entry.subtitle ?? null,
        authors: Array.isArray(entry.authors)
          ? entry.authors.map((name: string) => ({ name, role: "author" }))
          : [],
        publisher: entry.publisher ?? null,
        issued_at: date.issuedAt,
        issued_at_label: date.issuedAtLabel,
        issued_at_precision: date.issuedAtPrecision,
        summary: entry.summary ?? null,
        url: entry.url ?? null,
        availability: {
          online: Boolean(entry.online),
          digital_collection: true
        }
      };
    })
  };
}
```

- [ ] **Step 4: 詳細マッパーを書く**

```ts
import { normalizeIssuedAt } from "../../lib/date.js";

export function mapNdlDigitalRecordResponse(entry: any) {
  const date = normalizeIssuedAt(entry.issued ?? null);

  return {
    source: "ndl_digital",
    source_id: String(entry.id),
    title: entry.title ?? "Untitled",
    subtitle: entry.subtitle ?? null,
    authors: Array.isArray(entry.authors)
      ? entry.authors.map((name: string) => ({ name, role: "author" }))
      : [],
    publisher: entry.publisher ?? null,
    issued_at: date.issuedAt,
    issued_at_label: date.issuedAtLabel,
    issued_at_precision: date.issuedAtPrecision,
    summary: entry.summary ?? null,
    url: entry.url ?? null,
    availability: {
      online: Boolean(entry.online),
      digital_collection: true,
      access_note: entry.accessNote ?? null
    },
    alternative_titles: Array.isArray(entry.alternativeTitles) ? entry.alternativeTitles : [],
    publication_place: entry.publicationPlace ?? null,
    language: entry.language ?? null,
    material_type: entry.materialType ?? null,
    extent: entry.extent ?? null,
    subjects: Array.isArray(entry.subjects) ? entry.subjects : [],
    identifiers: entry.identifiers ?? {},
    table_of_contents: Array.isArray(entry.tableOfContents) ? entry.tableOfContents : [],
    content_access: {
      has_page_images: Boolean(entry.hasPageImages),
      has_text_coordinates: Boolean(entry.hasTextCoordinates),
      viewer_url: entry.viewerUrl ?? null,
      access_note: entry.accessNote ?? null
    },
    source_metadata: {
      provider: "National Diet Library",
      raw_url: entry.rawUrl ?? null
    },
    raw: entry
  };
}
```

- [ ] **Step 5: adapter 本体を書く**

```ts
import { fetchJson } from "../../lib/http.js";
import type { SourceAdapter } from "../types.js";
import { mapNdlDigitalRecordResponse } from "./mapRecord.js";
import { mapNdlDigitalSearchResponse } from "./mapSearch.js";

export function createNdlDigitalAdapter(baseUrl: string): SourceAdapter {
  return {
    source: "ndl_digital",
    async search({ query, limit, page }) {
      const url = new URL("/search", baseUrl);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("page", String(page));

      const payload = await fetchJson<any>(url.toString());
      return mapNdlDigitalSearchResponse(payload);
    },
    async getRecord(sourceId) {
      const url = new URL(`/record/${sourceId}`, baseUrl);
      const payload = await fetchJson<any>(url.toString());
      return mapNdlDigitalRecordResponse(payload);
    }
  };
}
```

- [ ] **Step 6: 実 API 仕様のメモを書く**

```md
# NDL Digital API Notes

- 検索エンドポイント URL
- 詳細取得エンドポイント URL
- 画像有無フィールド
- 座標有無フィールド
- 目次フィールド
- 利用条件メモ
```

- [ ] **Step 7: テストを再実行して通す**

Run: `npm test -- tests/ndlDigital.adapter.test.ts`  
Expected: PASS

- [ ] **Step 8: NDLデジタル adapter をコミットする**

```bash
git add src/sources/ndlDigital tests/ndlDigital.adapter.test.ts tests/fixtures/ndl-digital docs/api-notes/ndl-digital.md
git commit -m "feat: add NDL Digital adapter"
```

### Task 7: MCP ツール公開面を実装する

**Files:**
- Create: `src/lib/schemas.ts`
- Create: `src/tools/jpLitSearch.ts`
- Create: `src/tools/jpLitGetRecord.ts`
- Create: `src/server.ts`
- Create: `src/index.ts`
- Modify: `src/services/searchService.ts`
- Modify: `src/services/recordService.ts`
- Test: `tests/jpLitSearch.test.ts`
- Test: `tests/jpLitGetRecord.test.ts`

- [ ] **Step 1: ツール入力スキーマのテストを追加する**

```ts
import { describe, expect, it } from "vitest";
import { searchInputSchema, recordInputSchema } from "../src/lib/schemas.js";

describe("tool schemas", () => {
  it("search 入力を受け付ける", () => {
    const parsed = searchInputSchema.parse({ query: "夏目漱石", source: "ndl_search", limit: 5, page: 1 });
    expect(parsed.query).toBe("夏目漱石");
  });

  it("record 入力を受け付ける", () => {
    const parsed = recordInputSchema.parse({ source: "ndl_digital", source_id: "123" });
    expect(parsed.source_id).toBe("123");
  });
});
```

- [ ] **Step 2: スキーマ失敗を確認する**

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts`  
Expected: FAIL with missing schema exports

- [ ] **Step 3: Zod スキーマを書く**

```ts
import { z } from "zod";

export const sourceSchema = z.enum(["ndl_search", "ndl_digital"]);

export const searchInputSchema = z.object({
  query: z.string().min(1),
  source: sourceSchema.optional(),
  limit: z.number().int().positive().max(50).default(10),
  page: z.number().int().positive().default(1)
});

export const recordInputSchema = z.object({
  source: sourceSchema,
  source_id: z.string().min(1)
});
```

- [ ] **Step 4: ツールハンドラを書く**

```ts
import { searchInputSchema } from "../lib/schemas.js";
import type { ReturnTypeCreateSearchService } from "./types.js";

export function createJpLitSearchTool(searchService: ReturnTypeCreateSearchService) {
  return async (input: unknown) => {
    const parsed = searchInputSchema.parse(input);

    return searchService.search({
      query: parsed.query,
      source: parsed.source,
      limit: parsed.limit,
      page: parsed.page
    });
  };
}
```

```ts
import { recordInputSchema } from "../lib/schemas.js";
import type { ReturnTypeCreateRecordService } from "./types.js";

export function createJpLitGetRecordTool(recordService: ReturnTypeCreateRecordService) {
  return async (input: unknown) => {
    const parsed = recordInputSchema.parse(input);

    return recordService.getRecord({
      source: parsed.source,
      sourceId: parsed.source_id
    });
  };
}
```

- [ ] **Step 5: サーバー組み立てコードを書く**

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSearchService } from "./services/searchService.js";
import { createRecordService } from "./services/recordService.js";
import { createNdlSearchAdapter } from "./sources/ndlSearch/adapter.js";
import { createNdlDigitalAdapter } from "./sources/ndlDigital/adapter.js";
import { createJpLitSearchTool } from "./tools/jpLitSearch.js";
import { createJpLitGetRecordTool } from "./tools/jpLitGetRecord.js";

export async function startServer() {
  const adapters = [
    createNdlSearchAdapter(process.env.NDL_SEARCH_BASE_URL ?? "https://example.invalid"),
    createNdlDigitalAdapter(process.env.NDL_DIGITAL_BASE_URL ?? "https://example.invalid")
  ];

  const searchTool = createJpLitSearchTool(createSearchService(adapters));
  const recordTool = createJpLitGetRecordTool(createRecordService(adapters));

  const server = new Server(
    { name: "ndl-jp-lit-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.tool("jp_lit_search", "日本語文献ポータルを検索する", searchTool);
  server.tool("jp_lit_get_record", "文献レコード詳細を取得する", recordTool);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 6: エントリポイントを書く**

```ts
import { startServer } from "./server.js";

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 7: テストを再実行して通す**

Run: `npm test -- tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts`  
Expected: PASS

- [ ] **Step 8: MCP 公開面をコミットする**

```bash
git add src/lib/schemas.ts src/tools src/server.ts src/index.ts tests/jpLitSearch.test.ts tests/jpLitGetRecord.test.ts
git commit -m "feat: expose MCP tools for search and record detail"
```

### Task 8: 実在 fixture 反映と全体検証を行う

**Files:**
- Modify: `tests/fixtures/ndl-search/search-response.json`
- Modify: `tests/fixtures/ndl-search/record-response.json`
- Modify: `tests/fixtures/ndl-digital/search-response.json`
- Modify: `tests/fixtures/ndl-digital/record-response.json`
- Modify: `docs/api-notes/ndl-search.md`
- Modify: `docs/api-notes/ndl-digital.md`
- Modify: `README.md`

- [ ] **Step 1: NDL Search の実レスポンス fixture を保存する**

```json
{
  "items": [
    {
      "id": "real-id",
      "title": "real-title"
    }
  ],
  "total": 1
}
```

- [ ] **Step 2: NDLデジタルの実レスポンス fixture を保存する**

```json
{
  "items": [
    {
      "id": "real-id",
      "title": "real-title"
    }
  ],
  "total": 1
}
```

- [ ] **Step 3: API メモを実データ構造に合わせて更新する**

```md
- title の実フィールド名
- author の実フィールド名
- published の実フィールド名
- toc の実フィールド名
- digital access の実フィールド名
```

- [ ] **Step 4: README に環境変数と実行方法を追記する**

```md
## 環境変数

- `NDL_SEARCH_BASE_URL`
- `NDL_DIGITAL_BASE_URL`

## 実行

```bash
npm run build
npm run dev
```
```

- [ ] **Step 5: 全テストを実行する**

Run: `npm test`  
Expected: PASS

- [ ] **Step 6: 型ビルドを実行する**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 7: 最終状態をコミットする**

```bash
git add README.md tests/fixtures docs/api-notes
git commit -m "test: replace placeholder fixtures with real API samples"
```

## セルフレビュー

- Spec coverage: `jp_lit_search`、`jp_lit_get_record`、共通スキーマ、日付正規化、目次、`content_access`、adapter 分離、本文画像/座標の分離方針をすべてタスクに割り当てた。
- Placeholder scan: 実 API の URL や実 fixture 値は Task 8 で置換する前提にしたが、どこを実データへ差し替えるかは各タスクに明示した。
- Type consistency: 外向き入力は `source_id`、service 内部は `sourceId` で統一的に変換する想定にした。`issued_at` 系フィールド名は全タスクで統一した。
