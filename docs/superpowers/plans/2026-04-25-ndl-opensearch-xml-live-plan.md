# NDL OpenSearch XML Live 対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NDL Search / NDLデジタルコレクション検索で返る OpenSearch XML を live で取り込み、既存の `jp_lit_search` / `jp_lit_get_record` から実検索できるようにする。

**Architecture:** `fetchJson` に加えて XML 取得と XML→JSON-compatible projection の層を追加する。`ndlSearch` / `ndlDigital` adapter では live XML をその projection に通し、既存の `mapSearch` / `mapRecord` を可能な限り再利用する。

**Tech Stack:** Node.js, TypeScript, MCP SDK, Zod, Vitest, fast-xml-parser

---

## 想定ファイル構成

- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/lib/http.ts`
- Create: `src/lib/xml.ts`
- Create: `src/sources/ndlSearch/projectOpenSearch.ts`
- Modify: `src/sources/ndlSearch/adapter.ts`
- Modify: `src/sources/ndlSearch/mapSearch.ts`
- Modify: `src/sources/ndlSearch/mapRecord.ts`
- Modify: `src/sources/ndlDigital/adapter.ts`
- Modify: `src/sources/ndlDigital/mapSearch.ts`
- Modify: `src/sources/ndlDigital/mapRecord.ts`
- Modify: `tests/ndlSearch.adapter.test.ts`
- Modify: `tests/ndlDigital.adapter.test.ts`
- Create: `tests/xml.test.ts`
- Create: `tests/fixtures/ndl-search/search-response.xml`
- Create: `tests/fixtures/ndl-search/record-response.xml`
- Create: `tests/fixtures/ndl-digital/search-response.xml`
- Create: `tests/fixtures/ndl-digital/record-response.xml`
- Modify: `docs/api-notes/ndl-search.md`
- Modify: `docs/api-notes/ndl-digital.md`

## 実装方針

- XML の完全一般化は狙わない。NDL OpenSearch / 外部書誌 detail endpoint で現実に返る形へ対応する。
- adapter の責務は `取得` と `projection への変換` に留め、正規化は既存 mapper を引き続き使う。
- `ndl_digital` は引き続き `NDL Search API + dpid=ndl-dl` 前提を維持する。
- live XML parse が入った後も、既存の JSON-compatible fixture テストは残す。
- XML fixture を追加して、`live 応答に近い入力` を直接テストできるようにする。

## Task 1: XML パーサ基盤を追加する

**Files:**
- Modify: `package.json`
- Modify: `src/lib/http.ts`
- Create: `src/lib/xml.ts`
- Test: `tests/xml.test.ts`

- [x] **Step 1: XML 基盤テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { parseXml, projectOpenSearchXml } from "../src/lib/xml.js";

describe("xml helpers", () => {
  it("OpenSearch XML を object に変換できる", () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>test</title></channel></rss>`;
    const parsed = parseXml(xml);
    expect(parsed.rss.channel.title).toBe("test");
  });

  it("channel/item を JSON-compatible projection に落とせる", () => {
    const xml = `<?xml version="1.0"?><rss><channel><openSearch:totalResults>1</openSearch:totalResults><item><title>国立国会図書館年報</title></item></channel></rss>`;
    const projected = projectOpenSearchXml(xml);
    expect(projected.channel.item.title).toBe("国立国会図書館年報");
  });
});
```

- [x] **Step 2: テストを実行して失敗確認する**

Run: `npm test -- tests/xml.test.ts`  
Expected: FAIL with missing xml helper module

- [x] **Step 3: XML パーサ依存を追加する**

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fast-xml-parser": "^5.0.0",
    "zod": "^3.23.8"
  }
}
```

- [x] **Step 4: XML helper を実装する**

```ts
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false
});

export function parseXml(xml: string) {
  return parser.parse(xml);
}

export function projectOpenSearchXml(xml: string) {
  const parsed = parseXml(xml);
  return parsed;
}
```

- [x] **Step 5: http 層に text 取得を追加する**

```ts
export async function fetchText(
  input: string | URL,
  init?: RequestInit
): Promise<{ text: string; contentType: string | null }> {
  const response = init ? await fetch(input, init) : await fetch(input);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  return {
    text: await response.text(),
    contentType: response.headers?.get("content-type") ?? null
  };
}
```

- [x] **Step 6: XML 基盤テストを再実行して通す**

Run: `npm test -- tests/xml.test.ts`  
Expected: PASS

- [x] **Step 7: XML 基盤をコミットする**

```bash
git add package.json package-lock.json src/lib/http.ts src/lib/xml.ts tests/xml.test.ts
git commit -m "feat: add XML parsing foundation for NDL live responses"
```

## Task 2: NDL Search の live XML projection を実装する

**Files:**
- Create: `src/sources/ndlSearch/projectOpenSearch.ts`
- Modify: `src/sources/ndlSearch/adapter.ts`
- Modify: `src/sources/ndlSearch/mapSearch.ts`
- Modify: `src/sources/ndlSearch/mapRecord.ts`
- Create: `tests/fixtures/ndl-search/search-response.xml`
- Create: `tests/fixtures/ndl-search/record-response.xml`
- Modify: `tests/ndlSearch.adapter.test.ts`

- [x] **Step 1: XML fixture ベースの NDL Search テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectNdlSearchOpenSearchXml } from "../src/sources/ndlSearch/projectOpenSearch.js";
import { mapNdlSearchSearchResponse } from "../src/sources/ndlSearch/mapSearch.js";

describe("NDL Search live XML", () => {
  it("OpenSearch XML を mapper が読める shape に投影できる", () => {
    const xml = readFileSync("tests/fixtures/ndl-search/search-response.xml", "utf8");
    const payload = projectNdlSearchOpenSearchXml(xml);
    const result = mapNdlSearchSearchResponse(payload);
    expect(result.items.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: テスト失敗を確認する**

Run: `npm test -- tests/ndlSearch.adapter.test.ts`  
Expected: FAIL with missing projection module

- [x] **Step 3: NDL Search XML projection を実装する**

```ts
import { parseXml } from "../../lib/xml.js";

export function projectNdlSearchOpenSearchXml(xml: string) {
  const parsed = parseXml(xml);
  return parsed.rss ?? parsed;
}
```

- [x] **Step 4: adapter を live XML fallback 対応にする**

```ts
const { text, contentType } = await fetchText(url.toString());
if (contentType?.includes("xml") || text.trim().startsWith("<?xml")) {
  return mapNdlSearchSearchResponse(projectNdlSearchOpenSearchXml(text));
}
return mapNdlSearchSearchResponse(await fetchJson(url.toString()));
```

- [x] **Step 5: detail endpoint の XML / JSON 揺れを吸収する**

```ts
const { text, contentType } = await fetchText(url.toString());
if (contentType?.includes("xml") || text.trim().startsWith("<?xml")) {
  return mapNdlSearchRecordResponse(projectNdlSearchOpenSearchXml(text));
}
return mapNdlSearchRecordResponse(await fetchJson(url.toString()));
```

- [x] **Step 6: fixture とテストを実データ寄りに更新する**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss>
  <channel>
    <openSearch:totalResults>1</openSearch:totalResults>
    <item>
      <title>国立国会図書館年報</title>
    </item>
  </channel>
</rss>
```

- [x] **Step 7: NDL Search XML テストを再実行して通す**

Run: `npm test -- tests/ndlSearch.adapter.test.ts`  
Expected: PASS

- [x] **Step 8: NDL Search live XML 対応をコミットする**

```bash
git add src/sources/ndlSearch src/lib/xml.ts tests/ndlSearch.adapter.test.ts tests/fixtures/ndl-search
git commit -m "feat: support live NDL Search OpenSearch XML"
```

## Task 3: NDLデジタルコレクションの live XML projection を実装する

**Files:**
- Modify: `src/sources/ndlDigital/adapter.ts`
- Modify: `src/sources/ndlDigital/mapSearch.ts`
- Modify: `src/sources/ndlDigital/mapRecord.ts`
- Create: `tests/fixtures/ndl-digital/search-response.xml`
- Create: `tests/fixtures/ndl-digital/record-response.xml`
- Modify: `tests/ndlDigital.adapter.test.ts`

- [x] **Step 1: XML fixture ベースの ndl_digital テストを書く**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectNdlSearchOpenSearchXml } from "../src/sources/ndlSearch/projectOpenSearch.js";
import { mapNdlDigitalSearchResponse } from "../src/sources/ndlDigital/mapSearch.js";

describe("NDL Digital live XML", () => {
  it("dpid=ndl-dl の XML を ndl_digital の search result に正規化できる", () => {
    const xml = readFileSync("tests/fixtures/ndl-digital/search-response.xml", "utf8");
    const payload = projectNdlSearchOpenSearchXml(xml);
    const result = mapNdlDigitalSearchResponse(payload);
    expect(result.items.every((item) => item.source === "ndl_digital")).toBe(true);
  });
});
```

- [x] **Step 2: テスト失敗を確認する**

Run: `npm test -- tests/ndlDigital.adapter.test.ts`  
Expected: FAIL with assertion mismatch

- [x] **Step 3: adapter を XML fallback 対応にする**

```ts
const { text, contentType } = await fetchText(url.toString());
if (contentType?.includes("xml") || text.trim().startsWith("<?xml")) {
  return mapNdlDigitalSearchResponse(projectNdlSearchOpenSearchXml(text));
}
```

- [x] **Step 4: providerId / digitalCollection 安全判定が XML 投影後も効くことを確認する**

```ts
expect(record).toBeNull();
```

- [x] **Step 5: ndl_digital XML テストを再実行して通す**

Run: `npm test -- tests/ndlDigital.adapter.test.ts`  
Expected: PASS

- [x] **Step 6: ndl_digital live XML 対応をコミットする**

```bash
git add src/sources/ndlDigital tests/ndlDigital.adapter.test.ts tests/fixtures/ndl-digital
git commit -m "feat: support live ndl_digital XML responses"
```

## Task 4: 実運用向けの検証と文書更新を行う

**Files:**
- Modify: `README.md`
- Modify: `docs/api-notes/ndl-search.md`
- Modify: `docs/api-notes/ndl-digital.md`
- Modify: `scripts/smoke-mcp.ts`

- [x] **Step 1: live 検索 smoke を追加する**

```ts
const result = await searchTool({
  query: "菊池寛",
  source: "ndl_search",
  limit: 5,
  page: 1
});
console.log(result.structuredContent.total);
```

- [x] **Step 2: README に live 対応範囲を追記する**

```md
## live 対応状況

- `ndl_search`: OpenSearch XML の live 検索に対応
- `ndl_digital`: `dpid=ndl-dl` の live 検索に対応
- detail endpoint は provider 安全判定つき
```

- [x] **Step 3: API notes に XML projection 方針を追記する**

```md
- XML は `fast-xml-parser` で object 化する
- adapter では projection 後に既存 mapper を流用する
```

- [x] **Step 4: 全テストを実行する**

Run: `npm test`  
Expected: PASS

- [x] **Step 5: 型ビルドを実行する**

Run: `npm run build`  
Expected: PASS

- [x] **Step 6: live 検索 smoke を実行する**

Run: `npm run smoke:mcp`  
Expected: PASS

- [x] **Step 7: 変更をコミットする**

## 実績メモ

- Task 1 完了
  - XML helper と OpenSearch projection 基盤を追加
  - コミット: `2736aba`, `36966d2`
- Task 2 完了
  - `ndl_search` の live XML 検索 / 詳細取得に対応
  - コミット: `22211a4`, `46e9ff9`
- Task 3 完了
  - `ndl_digital` の live XML 検索 / 詳細取得に対応
  - provider 判定を安全側へ補強
  - コミット: `218247b`
- Task 4 完了
  - README / API notes / smoke script を更新
  - `ndl_search`, `ndl_digital` の live smoke を実 API で確認
  - `detail JSON` に複数 `items` がある場合は digital item を優先選択
  - コミット: `81b1d20`

```bash
git add README.md docs/api-notes scripts/smoke-mcp.ts
git commit -m "docs: document live XML support"
```

## セルフレビュー

- Scope: `OpenSearch XML live parse` に限定し、CiNii や本文座標までは広げていない。
- Reuse: 既存 `mapSearch` / `mapRecord` を再利用する前提にしており、adapter の差分を最小にしている。
- Risk: XML の完全一般化ではなく NDL の実応答に寄せるので、fixture に加えて live smoke を必須にしている。
