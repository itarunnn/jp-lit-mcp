# NDL Sources: OpenSearch → SRU Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NDL Search 系 source（ndl_search / ndl_catalog / ndl_articles / ndl_articles_online / ndl_digital）の検索を OpenSearch API から SRU API に切り替え、ソートとファセット機能を追加する。

**Architecture:** `src/sources/ndlSearch/projectOpenSearch.ts` を新規 `parseSru.ts` に置き換える。SRU パーサーは既存 mapper (`mapNdlSearchSearchEntry` 等) が消費できる同一の中間 shape を出力するため、mapper は変更不要。`ndlDigital/adapter.ts` も同じ `projectNdlSearchOpenSearchXml` を使っているため同時に移行する。`getRecord` は引き続き `bib/external/search` JSON API を使用し変更なし。

**Tech Stack:** TypeScript, fast-xml-parser（既存 `lib/xml.ts`）, Vitest（既存テスト）

---

## 設計レビュー（2026-04-26）

### 方針として正しい点

- **中間 shape を揃えてマッパーを変更しない**という核心のアイデアは正しい。`mapNdlSearchSearchEntry` は既に `record.id`、`record.ciniiCrid`、`record.journalTitle` 等のキーを読む設計になっており、`parseSru.ts` がそれを出力すれば mapper 側はノータッチで済む。
- `getRecord` を SRU に切り替えない判断は正しい。SRU は検索専用。
- Task 0 を必須にしているのは正しい。dcndl_v3 の実フィールド名が確認前では仮定だらけ。

### 要注意点（優先度順）

**[高] ndlDigital のフィルタが壊れる可能性**

`mapNdlDigitalSearchResponse` は `digital_collection: true` のアイテムだけを残す（`ndlDigital/mapSearch.ts:18`）。現状の OpenSearch では `providerId?.startsWith("ndl-dl") === true` でこのフラグが立つ。しかし計画の `parseSru.ts` は `providerId: null` に固定し、`digitalCollection: viewerUrl !== null`（viewer URL がある場合のみ true）にしている。

→ viewer URL を持たない限定公開デジタル資料がフィルタで消える恐れがある。`dpid=ndl-dl` で問い合わせている以上、全件デジタルと断言できるので、Task 4 で **`parseSru.ts` 側で `digitalCollection: true` に固定する**か、**ndlDigital adapter 側でフィルタをなくす**かを選んで対処すること。

**[中] URL 書き換えハックが脆い**

Task 3 Step 3 の `searchBaseUrl.replace("/api/opensearch", "/api/sru")` は、`NDL_SEARCH_BASE_URL` が `/api/opensearch` を含まない形で設定されているとサイレントに壊れる。デフォルト値を最初から `/api/sru` に変えて、README に「`NDL_SEARCH_BASE_URL` を SRU URL に更新してください」と記載するほうが素直。後方互換変換コードは不要。

**[中] alternativeTitles と materialType のフィールド名が仮定**

Task 2 の `parseSru.ts` は以下を仮定しているが、Task 0 で実レスポンスを確認するまで確定させないこと：

| フィールド | OpenSearch で使うキー | 計画が仮定する dcndl_v3 キー |
|---|---|---|
| alternativeTitles | `dcndl:alternative` | `dcterms:alternative` |
| materialType | categories のうち非"デジタル"値 | `dcterms:type` |
| accessNote | `dcndl:access` | `dcndl:access` または `dcndl:accessRights` |

**[低] `online` フラグの挙動が微妙に変わる**

OpenSearch 版: `online: accessNote !== null`
計画の SRU 版: `online: accessNote !== null || viewerUrl !== null`

viewer URL があれば online 扱いにする変更は意味的に正しいが、挙動変更であることを把握しておくこと。

---

## 事前調査（Task 0 完了後に Task 1 以降を進めること）

---

### Task 0: SRU API 実レスポンス確認

**目的:** dcndl_v3 の実際の XML 構造を確認し、Task 2 の field mapping を確定させる。

**Files:** なし（調査のみ）

- [ ] **Step 1: ndl_catalog で SRU 検索を叩く**

```bash
curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=1&query=dpid%3Diss-ndl-opac%20AND%20anywhere%3D%22%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%22" | head -200
```

- [ ] **Step 2: ndl_articles (zassaku) で SRU 検索を叩く**

```bash
curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=1&query=dpid%3Dzassaku%20AND%20anywhere%3D%22%E5%A4%8F%E7%9B%AE%E6%BC%B1%E7%9F%B3%22" | head -300
```

- [ ] **Step 3: ソートを試す**

```bash
curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=3&sortKeys=title,,1&query=dpid%3Diss-ndl-opac%20AND%20anywhere%3D%22%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%22" | head -100
```

- [ ] **Step 4: レスポンス構造をメモする**

以下を確認してメモしておくこと（Task 2 の実装で使う）：
- `searchRetrieveResponse` 内の `numberOfRecords` の XPath
- `records/record/recordData` 内の RDF 要素名
- `dcndl:BibResource` の各フィールド名（title / creator / publisher / issued / identifier / description / language 等）
- `extraResponseData` のファセット構造（`lst name="REPOSITORY_NO"` など）
- ndl_articles (zassaku) の `dc:description` に「掲載誌：XXX」が含まれるか確認
- ndl_digital (dpid=ndl-dl) で viewer URL (dl.ndl.go.jp) が含まれるフィールド名

- [ ] **Step 5: ndl_digital を確認**

```bash
curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=1&query=dpid%3Dndl-dl%20AND%20anywhere%3D%22%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%22" | head -300
```

---

### Task 1: SRU XML パーサーを `lib/xml.ts` に追加

**Files:**
- Modify: `src/lib/xml.ts`
- Test: `tests/xml.test.ts`

- [ ] **Step 1: `parseSruXml` の失敗テストを書く**

`tests/xml.test.ts` の末尾に追加：

```typescript
describe("parseSruXml", () => {
  it("SRU searchRetrieveResponse XML を records 配列と totalRecords に分解する", async () => {
    const { parseSruXml } = await import("../src/lib/xml.js");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.1</version>
  <numberOfRecords>42</numberOfRecords>
  <nextRecordPosition>11</nextRecordPosition>
  <records>
    <record>
      <recordSchema>dcndl_v3</recordSchema>
      <recordPacking>xml</recordPacking>
      <recordData>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:dcndl="http://ndl.go.jp/dcndl/terms/"
                 xmlns:dcterms="http://purl.org/dc/terms/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/"
                 xmlns:foaf="http://xmlns.com/foaf/0.1/">
          <dcndl:BibResource rdf:about="https://ndlsearch.ndl.go.jp/books/R100000002-I000001234">
            <dcterms:title>こころ</dcterms:title>
            <dc:creator>夏目漱石</dc:creator>
            <dcterms:issued>1914</dcterms:issued>
          </dcndl:BibResource>
        </rdf:RDF>
      </recordData>
    </record>
  </records>
  <extraResponseData>
    <lst xmlns="http://www.loc.gov/zing/srw/" name="ISSUED_DATE">
      <int name="1914">1</int>
    </lst>
  </extraResponseData>
</searchRetrieveResponse>`;

    const result = parseSruXml(xml);

    expect(result.numberOfRecords).toBe(42);
    expect(result.records).toHaveLength(1);
    expect(result.extraResponseData).toBeDefined();
  });

  it("壊れた SRU XML は InvalidXmlError を投げる", async () => {
    const { parseSruXml } = await import("../src/lib/xml.js");
    await expect(() => parseSruXml("<broken")).toThrow();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/xml.test.ts 2>&1 | tail -20
```

Expected: `parseSruXml is not a function` またはインポートエラー

- [ ] **Step 3: `parseSruXml` を `lib/xml.ts` に実装**

`src/lib/xml.ts` の末尾に追加：

```typescript
export interface SruXmlResult {
  numberOfRecords: number;
  nextRecordPosition: number | null;
  records: XmlObject[];
  extraResponseData: XmlObject | null;
}

export function parseSruXml(xml: string): SruXmlResult {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new InvalidXmlError(`Invalid SRU XML: ${result.err.msg}`);
  }

  const parsed = parser.parse(xml) as XmlObject;
  const response = isRecord(parsed["searchRetrieveResponse"])
    ? (parsed["searchRetrieveResponse"] as XmlObject)
    : {};

  const totalRaw = response["numberOfRecords"];
  const numberOfRecords = typeof totalRaw === "number"
    ? totalRaw
    : Number(String(totalRaw ?? "0"));

  const nextRaw = response["nextRecordPosition"];
  const nextRecordPosition = nextRaw != null ? Number(String(nextRaw)) : null;

  const recordsBlock = isRecord(response["records"])
    ? (response["records"] as XmlObject)
    : {};
  const rawRecord = recordsBlock["record"];
  const records: XmlObject[] = Array.isArray(rawRecord)
    ? (rawRecord as XmlObject[]).filter(isRecord)
    : isRecord(rawRecord)
      ? [rawRecord as XmlObject]
      : [];

  const extraResponseData = isRecord(response["extraResponseData"])
    ? (response["extraResponseData"] as XmlObject)
    : null;

  return { numberOfRecords, nextRecordPosition, records, extraResponseData };
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/xml.test.ts 2>&1 | tail -20
```

Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/xml.ts tests/xml.test.ts
git commit -m "feat(xml): add parseSruXml for SRU searchRetrieveResponse parsing"
```

---

### Task 2: `ndlSearch/parseSru.ts` を新規作成

**目的:** SRU dcndl_v3 レスポンスを、既存 `mapNdlSearchSearchEntry` が消費できる中間 shape に変換する。Task 0 で確認したフィールド名をここで使う。

**Files:**
- Create: `src/sources/ndlSearch/parseSru.ts`
- Test: `tests/ndlSearch.adapter.test.ts`（新しい describe ブロックを追加）

**前提:** `mapNdlSearchSearchEntry` が読む中間 shape（`projectOpenSearch.ts` が現在出力している形）：

```typescript
{
  id: string | null,
  ciniiCrid: string | null,
  title: string,
  subtitle: string | null,
  authors: Array<{ name: string; role: "author" }>,
  publisher: string | null,
  issued: string | null,
  url: string | null,
  online: boolean,
  digitalCollection: boolean,
  providerId: string | null,
  providerName: string | null,
  alternativeTitles: string[],
  publicationPlace: string | null,
  language: string | null,
  materialType: string | null,
  identifiers: Record<string, string>,
  viewerUrl: string | null,
  accessNote: string | null,
  hasPageImages: boolean,
  hasTextCoordinates: boolean,
  journalTitle: string | null,
}
```

- [ ] **Step 1: fixture を作成する**

Task 0 で取得した実際の dcndl_v3 XML を元に fixture ファイルを作成：

```bash
# Task 0 の curl 結果をファイルに保存
curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=2&query=dpid%3Diss-ndl-opac%20AND%20anywhere%3D%22%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%22" > tests/fixtures/ndl-sru/search-ndl-catalog.xml

curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=2&query=dpid%3Dzassaku%20AND%20anywhere%3D%22%E5%A4%8F%E7%9B%AE%E6%BC%B1%E7%9F%B3%22" > tests/fixtures/ndl-sru/search-ndl-articles.xml

mkdir -p tests/fixtures/ndl-sru
```

- [ ] **Step 2: `projectNdlSruSearchResponse` の失敗テストを書く**

`tests/ndlSearch.adapter.test.ts` に describe ブロックを追加：

```typescript
describe("projectNdlSruSearchResponse", () => {
  it("SRU dcndl_v3 XML を items 配列と total に変換する", async () => {
    const { projectNdlSruSearchResponse } = await import(
      "../src/sources/ndlSearch/parseSru.js"
    );
    // Task 0 で確認した実際のフィールド名に合わせて XML を書くこと
    // 以下は仮の XML — 実際のレスポンス構造に合わせて修正する
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <numberOfRecords>100</numberOfRecords>
  <records>
    <record>
      <recordData>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
                 xmlns:dcndl="http://ndl.go.jp/dcndl/terms/"
                 xmlns:dcterms="http://purl.org/dc/terms/"
                 xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dcndl:BibResource rdf:about="https://ndlsearch.ndl.go.jp/books/R100000039-I1000732">
            <dcterms:title>国立国会図書館年報</dcterms:title>
            <dc:creator>国立国会図書館総務部</dc:creator>
            <dcterms:issued>2023</dcterms:issued>
          </dcndl:BibResource>
        </rdf:RDF>
      </recordData>
    </record>
  </records>
</searchRetrieveResponse>`;

    const result = projectNdlSruSearchResponse(xml);

    expect(result.total).toBe(100);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "国立国会図書館年報",
      id: "R100000039-I1000732",
    });
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlSearch.adapter.test.ts 2>&1 | tail -20
```

- [ ] **Step 4: `parseSru.ts` を実装する**

`src/sources/ndlSearch/parseSru.ts` を新規作成。
**注意: Task 0 で確認した実際のフィールド名に合わせて XPath を調整すること。**

```typescript
import { parseSruXml, type XmlObject } from "../../lib/xml.js";
import { compactStrings, normalizeText } from "../../lib/normalize.js";
import { readNdlSearchString, readNdlSearchStringList } from "./mapSearch.js";

function asRecord(value: unknown): XmlObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as XmlObject;
}

function extractSourceId(aboutUrl: string | null): string | null {
  if (!aboutUrl) return null;
  try {
    return new URL(aboutUrl).pathname.split("/").filter(Boolean).at(-1) ?? null;
  } catch {
    return null;
  }
}

function extractCiniiCrid(seeAlsoValue: unknown): string | null {
  for (const url of readNdlSearchStringList(seeAlsoValue)) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "cir.nii.ac.jp" && parsed.pathname.startsWith("/crid/")) {
        const crid = parsed.pathname.replace(/^\/crid\//, "").replace(/[/.].*/s, "");
        if (crid) return crid;
      }
    } catch { /* ignore */ }
  }
  return null;
}

function extractJournalTitle(descriptions: unknown): string | null {
  for (const desc of readNdlSearchStringList(descriptions)) {
    const match = desc.match(/^掲載誌：(.+)/);
    if (!match) continue;
    const title = match[1].split(/ =| \/| p\./)[0]?.trim() ?? null;
    return title || null;
  }
  return null;
}

function readIdentifiers(dcIdentifier: unknown): Record<string, string> {
  const entries = Array.isArray(dcIdentifier)
    ? dcIdentifier
    : dcIdentifier == null ? [] : [dcIdentifier];
  const identifiers: Record<string, string> = {};

  for (const entry of entries) {
    const record = asRecord(entry);
    const text = readNdlSearchString(record?.["#text"] ?? entry);
    const type = normalizeText(
      readNdlSearchString(record?.["@_xsi:type"]) ??
      readNdlSearchString(record?.["xsi:type"])
    )?.toLowerCase();

    if (!text || !type) continue;
    if (type.endsWith("issn")) { identifiers.issn = text; continue; }
    if (type.endsWith("issnl")) { identifiers.issnl = text; continue; }
    if (type.endsWith("ndljp") || type.includes("ndl-bib")) { identifiers.ndljp = text; }
  }

  return identifiers;
}

function pickViewerUrl(seeAlsoValue: unknown): string | null {
  return readNdlSearchStringList(seeAlsoValue).find(url => {
    try { return new URL(url).hostname === "dl.ndl.go.jp"; }
    catch { return false; }
  }) ?? null;
}

function projectBibResource(bib: XmlObject): XmlObject {
  // Task 0 で確認した実際のフィールド名に合わせて修正すること
  const aboutUrl = readNdlSearchString(bib["@_rdf:about"]);
  const id = extractSourceId(aboutUrl);
  const url = aboutUrl;
  const seeAlso = bib["rdfs:seeAlso"];
  const viewerUrl = pickViewerUrl(seeAlso);
  const ciniiCrid = extractCiniiCrid(seeAlso);
  const dcDescription = bib["dc:description"];
  const journalTitle = extractJournalTitle(dcDescription);
  const accessNote = readNdlSearchString(bib["dcndl:access"] ?? bib["dcndl:accessRights"]);

  const creatorRaw = bib["dc:creator"] ?? bib["dcterms:creator"];
  const authorNames = compactStrings(readNdlSearchStringList(creatorRaw));

  const identifiers = readIdentifiers(bib["dc:identifier"]);

  return {
    id,
    ciniiCrid: ciniiCrid ?? null,
    title: readNdlSearchString(bib["dcterms:title"] ?? bib["dc:title"]) ?? "Untitled",
    subtitle: readNdlSearchString(bib["dcndl:volumeTitle"] ?? bib["dcndl:volume"]),
    authors: authorNames.map(name => ({ name, role: "author" })),
    publisher: readNdlSearchString(bib["dcterms:publisher"] ?? bib["dc:publisher"]),
    issued: readNdlSearchString(bib["dcterms:issued"] ?? bib["dc:date"]),
    url,
    online: accessNote !== null || viewerUrl !== null,
    digitalCollection: viewerUrl !== null,
    providerId: null,
    providerName: readNdlSearchString(bib["dcndl:provider"]),
    alternativeTitles: compactStrings(readNdlSearchStringList(bib["dcterms:alternative"])),
    publicationPlace: readNdlSearchString(bib["dcndl:publicationPlace"]),
    language: readNdlSearchString(bib["dcterms:language"] ?? bib["dc:language"]),
    materialType: readNdlSearchString(bib["dcterms:type"] ?? bib["dc:type"]),
    identifiers,
    viewerUrl,
    accessNote,
    hasPageImages: viewerUrl !== null,
    hasTextCoordinates: false,
    journalTitle,
  };
}

function extractBibResource(record: XmlObject): XmlObject | null {
  const recordData = asRecord(record["recordData"]);
  if (!recordData) return null;

  // fast-xml-parser は namespace prefix を保持するため rdf:RDF を探す
  const rdfKey = Object.keys(recordData).find(k => k === "rdf:RDF" || k.endsWith(":RDF"));
  const rdfRdf = asRecord(recordData[rdfKey ?? "rdf:RDF"]);
  if (!rdfRdf) return null;

  const bibKey = Object.keys(rdfRdf).find(k => k === "dcndl:BibResource" || k.endsWith(":BibResource"));
  return asRecord(rdfRdf[bibKey ?? "dcndl:BibResource"]) ?? null;
}

export function parseSruFacets(extraResponseData: XmlObject | null): {
  providers: Record<string, number>;
  ndc: Record<string, number>;
  issued_years: Record<string, number>;
} {
  const result = { providers: {} as Record<string, number>, ndc: {} as Record<string, number>, issued_years: {} as Record<string, number> };
  if (!extraResponseData) return result;

  const lists = Array.isArray(extraResponseData["lst"])
    ? extraResponseData["lst"]
    : extraResponseData["lst"] != null ? [extraResponseData["lst"]] : [];

  for (const lst of lists) {
    const record = asRecord(lst);
    if (!record) continue;
    const name = readNdlSearchString(record["@_name"]);
    const ints = Array.isArray(record["int"])
      ? record["int"]
      : record["int"] != null ? [record["int"]] : [];

    const target =
      name === "REPOSITORY_NO" ? result.providers :
      name === "NDC" ? result.ndc :
      name === "ISSUED_DATE" ? result.issued_years : null;

    if (!target) continue;
    for (const item of ints) {
      const itemRecord = asRecord(item);
      const key = readNdlSearchString(itemRecord?.["@_name"]);
      const value = Number(readNdlSearchString(itemRecord?.["#text"] ?? item));
      if (key && !isNaN(value)) target[key] = value;
    }
  }

  return result;
}

export function projectNdlSruSearchResponse(xml: string): {
  total: number;
  items: XmlObject[];
  facets: ReturnType<typeof parseSruFacets>;
} {
  const { numberOfRecords, records, extraResponseData } = parseSruXml(xml);
  const items = records
    .map(record => extractBibResource(record))
    .filter((bib): bib is XmlObject => bib !== null)
    .map(bib => projectBibResource(bib));

  return {
    total: numberOfRecords,
    items,
    facets: parseSruFacets(extraResponseData),
  };
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlSearch.adapter.test.ts 2>&1 | tail -30
```

- [ ] **Step 6: fixtures を使った統合テストを追加する**

Task 0 で保存した XML fixture を使い、実際のフィールドが正しくマッピングされることを確認するテストを追加：

```typescript
// tests/ndlSearch.adapter.test.ts に追加
it("ndl_catalog の実 fixture から journal_title 以外の主要フィールドが取れる", async () => {
  const xml = readTextFixture("../ndl-sru/search-ndl-catalog.xml");
  const { projectNdlSruSearchResponse } = await import(
    "../src/sources/ndlSearch/parseSru.js"
  );
  const { mapNdlSearchSearchResponse } = await import(
    "../src/sources/ndlSearch/mapSearch.js"
  );

  const projected = projectNdlSruSearchResponse(xml);
  const result = mapNdlSearchSearchResponse(projected);

  expect(result.total).toBeGreaterThan(0);
  expect(result.items[0]?.title).not.toBe("Untitled");
  expect(result.items[0]?.source_id).toMatch(/^R/);
});

it("ndl_articles の実 fixture から journal_title が抽出できる", async () => {
  const xml = readTextFixture("../ndl-sru/search-ndl-articles.xml");
  const { projectNdlSruSearchResponse } = await import(
    "../src/sources/ndlSearch/parseSru.js"
  );
  const { mapNdlSearchSearchResponse } = await import(
    "../src/sources/ndlSearch/mapSearch.js"
  );

  const projected = projectNdlSruSearchResponse(xml);
  const result = mapNdlSearchSearchResponse(projected);

  expect(result.total).toBeGreaterThan(0);
  // dc:description に「掲載誌：」が含まれるレコードがあれば journal_title が入る
  const withJournal = result.items.filter(item => item.journal_title !== null);
  expect(withJournal.length).toBeGreaterThan(0);
});
```

- [ ] **Step 7: テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlSearch.adapter.test.ts 2>&1 | tail -30
```

- [ ] **Step 8: コミット**

```bash
git add src/sources/ndlSearch/parseSru.ts tests/ndlSearch.adapter.test.ts tests/fixtures/ndl-sru/
git commit -m "feat(ndlSearch): add SRU dcndl_v3 XML parser (parseSru.ts)"
```

---

### Task 3: ndlSearch adapter を SRU に切り替え

**Files:**
- Modify: `src/sources/ndlSearch/adapter.ts`
- Test: `tests/ndlSearch.adapter.test.ts`

- [ ] **Step 1: adapter の SRU URL テストを追加**

既存の `createNdlSearchAdapter` describe に追加：

```typescript
it("SRU エンドポイントに operation=searchRetrieve と CQL query を送る", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: (n: string) => n === "content-type" ? "application/xml" : null },
    text: async () => readTextFixture("../ndl-sru/search-ndl-catalog.xml")
  });
  vi.stubGlobal("fetch", fetch);

  const { createNdlCatalogAdapter } = await import("../src/sources/ndlSearch/adapter.js");
  const adapter = createNdlCatalogAdapter();
  await adapter.search({ query: "夏目漱石", limit: 5, page: 2 });

  const calledUrl = new URL(fetch.mock.calls[0][0] as string);
  expect(calledUrl.pathname).toBe("/api/sru");
  expect(calledUrl.searchParams.get("operation")).toBe("searchRetrieve");
  expect(calledUrl.searchParams.get("recordSchema")).toBe("dcndl_v3");
  expect(calledUrl.searchParams.get("maximumRecords")).toBe("5");
  expect(calledUrl.searchParams.get("startRecord")).toBe("6"); // page=2, limit=5 → offset=5+1
  const query = calledUrl.searchParams.get("query") ?? "";
  expect(query).toContain("iss-ndl-opac");
  expect(query).toContain("夏目漱石");
});

it("ndl_articles source は zassaku を CQL に含める", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: (n: string) => n === "content-type" ? "application/xml" : null },
    text: async () => readTextFixture("../ndl-sru/search-ndl-articles.xml")
  });
  vi.stubGlobal("fetch", fetch);

  const { createNdlArticlesAdapter } = await import("../src/sources/ndlSearch/adapter.js");
  const adapter = createNdlArticlesAdapter();
  await adapter.search({ query: "漱石", limit: 5, page: 1 });

  const query = new URL(fetch.mock.calls[0][0] as string).searchParams.get("query") ?? "";
  expect(query).toContain("zassaku");
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlSearch.adapter.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: adapter.ts の search メソッドを SRU に書き換える**

`src/sources/ndlSearch/adapter.ts` で：

1. import を追加：
```typescript
import { projectNdlSruSearchResponse } from "./parseSru.js";
```

2. `fetchNdlSearchPayload` 関数を SRU 用に書き換える：
```typescript
async function fetchSruPayload(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }
  const text = await response.text();
  return projectNdlSruSearchResponse(text);
}
```

3. `createNdlSearchAdapter` の `search` メソッドを書き換える：
```typescript
async search({ query, limit, page }) {
  const url = new URL(searchBaseUrl.replace("/api/opensearch", "/api/sru").replace("/opensearch", "/sru"));
  const cqlQuery = buildCqlQuery(query, providerId);
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("version", "1.1");
  url.searchParams.set("recordSchema", "dcndl_v3");
  url.searchParams.set("maximumRecords", String(limit));
  url.searchParams.set("startRecord", String((page - 1) * limit + 1));
  url.searchParams.set("query", cqlQuery);

  const projected = await fetchSruPayload(url.toString()) as {
    total: number;
    items: Record<string, unknown>[];
    facets: unknown;
  };

  const result = mapNdlSearchSearchResponse(projected);
  return {
    total: result.total,
    items: result.items.map(item => withSource(item, source))
  };
},
```

4. `buildCqlQuery` ヘルパーを adapter.ts に追加：
```typescript
function buildCqlQuery(keyword: string, dpid?: string): string {
  // AND/OR を含むキーワードは引用符で囲む
  const escaped = keyword.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const keywordClause = `anywhere="${escaped}"`;
  if (dpid) {
    return `dpid=${dpid} AND ${keywordClause}`;
  }
  return keywordClause;
}
```

5. `searchBaseUrl` のデフォルト値を SRU に変更：
```typescript
const DEFAULT_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/sru";
```

6. 環境変数 `NDL_SEARCH_BASE_URL` を設定する際の注意：
   `server.ts` や `jpLitSearch.ts` で searchBaseUrl を注入している箇所があれば、
   OpenSearch URL が渡されている場合 SRU URL に変換する。
   または環境変数名を `NDL_SRU_BASE_URL` に追加する（既存設定との後方互換のため
   旧変数も読む）。

- [ ] **Step 4: テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlSearch.adapter.test.ts 2>&1 | tail -30
```

- [ ] **Step 5: 全テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm test 2>&1 | tail -20
```

- [ ] **Step 6: コミット**

```bash
git add src/sources/ndlSearch/adapter.ts
git commit -m "feat(ndlSearch): switch search from OpenSearch to SRU API"
```

---

### Task 4: ndlDigital adapter を SRU に切り替え

**Files:**
- Modify: `src/sources/ndlDigital/adapter.ts`
- Test: `tests/ndlDigital.adapter.test.ts`

- [ ] **Step 1: ndlDigital の SRU fixture を取得**

```bash
curl -s "https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.1&recordSchema=dcndl_v3&maximumRecords=2&query=dpid%3Dndl-dl%20AND%20anywhere%3D%22%E5%9B%BD%E7%AB%8B%E5%9B%BD%E4%BC%9A%E5%9B%B3%E6%9B%B8%E9%A4%A8%22" > tests/fixtures/ndl-sru/search-ndl-digital.xml
```

- [ ] **Step 2: adapter の SRU URL テストを追加**

`tests/ndlDigital.adapter.test.ts` に追加：

```typescript
it("SRU エンドポイントに dpid=ndl-dl を含む CQL query を送る", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: (n: string) => n === "content-type" ? "application/xml" : null },
    text: async () => readFileSync(
      new URL("./fixtures/ndl-sru/search-ndl-digital.xml", import.meta.url), "utf-8"
    )
  });
  vi.stubGlobal("fetch", fetch);

  const { createNdlDigitalAdapter } = await import("../src/sources/ndlDigital/adapter.js");
  const adapter = createNdlDigitalAdapter();
  await adapter.search({ query: "漱石", limit: 5, page: 1 });

  const calledUrl = new URL(fetch.mock.calls[0][0] as string);
  expect(calledUrl.pathname).toBe("/api/sru");
  const query = calledUrl.searchParams.get("query") ?? "";
  expect(query).toContain("ndl-dl");
});
```

- [ ] **Step 3: テストが失敗することを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlDigital.adapter.test.ts 2>&1 | tail -20
```

- [ ] **Step 4: ndlDigital/adapter.ts を SRU に書き換える**

`src/sources/ndlDigital/adapter.ts` で：

1. import を変更：
```typescript
// 削除:
import { projectNdlSearchOpenSearchXml } from "../ndlSearch/projectOpenSearch.js";
// 追加:
import { projectNdlSruSearchResponse } from "../ndlSearch/parseSru.js";
```

2. `fetchNdlDigitalPayload` を SRU 用に書き換える（XML 部分）：
```typescript
// assertXmlPayload ブロックを以下に置き換える:
return projectNdlSruSearchResponse(text);
```

3. search メソッドの URL パラメータを SRU に変更：
```typescript
async search({ query, limit, page }) {
  const url = new URL(searchBaseUrl.replace("/opensearch", "/sru").replace("/api/opensearch", "/api/sru"));
  const cqlQuery = `dpid=ndl-dl AND anywhere="${query.replace(/"/g, '\\"')}"`;
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("version", "1.1");
  url.searchParams.set("recordSchema", "dcndl_v3");
  url.searchParams.set("maximumRecords", String(limit));
  url.searchParams.set("startRecord", String((page - 1) * limit + 1));
  url.searchParams.set("query", cqlQuery);

  return mapNdlDigitalSearchResponse(
    await fetchNdlDigitalPayload(url.toString())
  );
},
```

4. `DEFAULT_SEARCH_BASE_URL` を SRU URL に変更：
```typescript
const DEFAULT_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/sru";
```

- [ ] **Step 5: テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm test 2>&1 | tail -20
```

- [ ] **Step 6: コミット**

```bash
git add src/sources/ndlDigital/adapter.ts tests/ndlDigital.adapter.test.ts tests/fixtures/ndl-sru/search-ndl-digital.xml
git commit -m "feat(ndlDigital): switch search from OpenSearch to SRU API"
```

---

### Task 5: ソートパラメータを追加

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/sources/ndlSearch/adapter.ts`
- Modify: `src/services/searchService.ts`
- Modify: `src/tools/jpLitSearch.ts`
- Test: `tests/ndlSearch.adapter.test.ts`, `tests/jpLitSearch.test.ts`

- [ ] **Step 1: `sources/types.ts` の SearchInput にソートを追加するテスト**

`tests/ndlSearch.adapter.test.ts` に追加：

```typescript
it("sort_by と sort_order を SRU の sortKeys に変換する", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: (n: string) => n === "content-type" ? "application/xml" : null },
    text: async () => readTextFixture("../ndl-sru/search-ndl-catalog.xml")
  });
  vi.stubGlobal("fetch", fetch);

  const { createNdlCatalogAdapter } = await import("../src/sources/ndlSearch/adapter.js");
  const adapter = createNdlCatalogAdapter();
  await adapter.search({ query: "漱石", limit: 5, page: 1, sort_by: "title", sort_order: "asc" });

  const calledUrl = new URL(fetch.mock.calls[0][0] as string);
  expect(calledUrl.searchParams.get("sortKeys")).toBe("title,,1");
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/ndlSearch.adapter.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: `src/sources/types.ts` の SearchInput にフィールド追加**

```typescript
// src/sources/types.ts の SearchInput interface に追加
interface SearchInput {
  query: string;
  limit: number;
  page: number;
  sort_by?: "title" | "creator" | "issued_date" | "created_date" | "modified_date";
  sort_order?: "asc" | "desc";
}
```

- [ ] **Step 4: ndlSearch adapter に sortKeys 対応を追加**

`src/sources/ndlSearch/adapter.ts` の search メソッド内に追加：

```typescript
async search({ query, limit, page, sort_by, sort_order }) {
  // ... 既存のパラメータ設定 ...
  if (sort_by) {
    const ascending = sort_order === "desc" ? "0" : "1";
    url.searchParams.set("sortKeys", `${sort_by},,${ascending}`);
  }
  // ...
}
```

- [ ] **Step 5: `src/lib/schemas.ts` に sort パラメータを追加**

```typescript
export const searchInputSchema = z.object({
  query: z.string().trim().min(1),
  source: sourceSchema.optional(),
  limit: z.number().int().positive().max(50).default(10),
  page: z.number().int().positive().default(1),
  sort_by: z.enum(["title", "creator", "issued_date", "created_date", "modified_date"]).optional(),
  sort_order: z.enum(["asc", "desc"]).default("asc").optional(),
});
```

- [ ] **Step 6: `src/services/searchService.ts` に sort を通す**

```typescript
// SearchInput interface に追加
interface SearchInput {
  // ...既存フィールド...
  sort_by?: "title" | "creator" | "issued_date" | "created_date" | "modified_date";
  sort_order?: "asc" | "desc";
}

// search メソッドで adapter に渡す
const result = await registry.get(input.source).search({
  ...input,
  sort_by: input.sort_by,
  sort_order: input.sort_order,
});
```

- [ ] **Step 7: `src/tools/jpLitSearch.ts` に sort を通す**

```typescript
const searchResult = await searchService.search({
  query: parsed.query,
  source: parsed.source,
  limit: parsed.limit,
  page: parsed.page,
  sort_by: parsed.sort_by,
  sort_order: parsed.sort_order,
});
```

- [ ] **Step 8: 全テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm test 2>&1 | tail -20
```

- [ ] **Step 9: コミット**

```bash
git add src/lib/schemas.ts src/lib/types.ts src/sources/types.ts src/sources/ndlSearch/adapter.ts src/services/searchService.ts src/tools/jpLitSearch.ts tests/ndlSearch.adapter.test.ts tests/jpLitSearch.test.ts
git commit -m "feat: add sort_by and sort_order parameters to jp_lit_search"
```

---

### Task 6: ファセットを追加

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/sources/types.ts`
- Modify: `src/services/searchService.ts`
- Modify: `src/tools/jpLitSearch.ts`
- Test: `tests/jpLitSearch.test.ts`

- [ ] **Step 1: SearchOutput にファセットが含まれるテストを追加**

`tests/jpLitSearch.test.ts` に追加：

```typescript
it("NDL source 検索結果に facets が含まれる", async () => {
  // facets 付きのモック adapter を作る
  const mockAdapter = {
    source: "ndl_catalog" as const,
    search: vi.fn().mockResolvedValue({
      total: 100,
      items: [],
      facets: {
        providers: { R100000001: 50, R100000002: 50 },
        ndc: { "9": 30 },
        issued_years: { "2020": 10, "2021": 15 }
      }
    }),
    getRecord: vi.fn()
  };
  const { createSearchService } = await import("../src/services/searchService.js");
  const service = createSearchService([mockAdapter]);
  const result = await service.search({ query: "漱石", source: "ndl_catalog", limit: 10, page: 1 });

  expect(result.facets).toMatchObject({
    providers: { R100000001: 50 },
    ndc: { "9": 30 },
    issued_years: { "2020": 10 }
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npx vitest run tests/jpLitSearch.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: `src/lib/types.ts` に Facets 型と SearchResult 更新**

```typescript
export interface Facets {
  providers: Record<string, number>;
  ndc: Record<string, number>;
  issued_years: Record<string, number>;
}

// SearchResult に facets を追加
// src/sources/types.ts の SearchResult:
export interface SearchResult {
  total: number;
  items: SearchItem[];
  facets?: Facets;
}
```

- [ ] **Step 4: `src/lib/schemas.ts` に facets スキーマを追加**

```typescript
export const facetsSchema = z.object({
  providers: z.record(z.string(), z.number()),
  ndc: z.record(z.string(), z.number()),
  issued_years: z.record(z.string(), z.number()),
}).optional();

// searchOutputSchema に追加
export const searchOutputSchema = z.object({
  query: z.string(),
  source: sourceSchema.nullable(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(searchItemSchema),
  facets: facetsSchema,
});
```

- [ ] **Step 5: ndlSearch adapter が facets を返すよう更新**

`src/sources/ndlSearch/adapter.ts` の search メソッドを更新：

```typescript
async search({ query, limit, page, sort_by, sort_order }) {
  // ... URL 構築 ...
  const projected = await fetchSruPayload(url.toString()) as {
    total: number;
    items: Record<string, unknown>[];
    facets: Facets;
  };

  const result = mapNdlSearchSearchResponse(projected);
  return {
    total: result.total,
    items: result.items.map(item => withSource(item, source)),
    facets: projected.facets,
  };
},
```

- [ ] **Step 6: `src/services/searchService.ts` が facets を結果に含める**

```typescript
// 単一 source 検索
const result = await registry.get(input.source).search(input);
return {
  total: result.total,
  items: withDefaultDuplicateInfo(result.items),
  facets: result.facets,
};

// 横断検索では facets をマージする
const mergedFacets: Facets = {
  providers: {},
  ndc: {},
  issued_years: {},
};
for (const result of results) {
  if (!result.facets) continue;
  for (const [k, v] of Object.entries(result.facets.providers)) {
    mergedFacets.providers[k] = (mergedFacets.providers[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(result.facets.ndc)) {
    mergedFacets.ndc[k] = (mergedFacets.ndc[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(result.facets.issued_years)) {
    mergedFacets.issued_years[k] = (mergedFacets.issued_years[k] ?? 0) + v;
  }
}
return {
  total: ...,
  items: annotateDuplicateCandidates(mergedItems),
  facets: mergedFacets,
};
```

- [ ] **Step 7: `src/tools/jpLitSearch.ts` が facets を structuredContent に含める**

```typescript
const structuredContent: SearchOutput = {
  query: parsed.query,
  source: parsed.source ?? null,
  page: parsed.page,
  limit: parsed.limit,
  total: searchResult.total,
  items: searchResult.items,
  facets: searchResult.facets,
};
```

- [ ] **Step 8: 全テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm test 2>&1 | tail -20
```

- [ ] **Step 9: コミット**

```bash
git add src/lib/types.ts src/lib/schemas.ts src/sources/types.ts src/sources/ndlSearch/adapter.ts src/services/searchService.ts src/tools/jpLitSearch.ts tests/jpLitSearch.test.ts
git commit -m "feat: add facets (providers / ndc / issued_years) to search output"
```

---

### Task 7: OpenSearch パーサー削除とクリーンアップ

**Files:**
- Delete: `src/sources/ndlSearch/projectOpenSearch.ts`
- Modify: `src/lib/xml.ts`（`projectOpenSearchXml` が不要なら削除）
- Test: `tests/ndlSearch.adapter.test.ts`（OpenSearch XML テストを SRU に置き換え）

- [ ] **Step 1: `projectOpenSearch.ts` の import が残っていないか確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && grep -r "projectOpenSearch" src/ tests/
```

残っている参照をすべて `parseSru` に置き換えてから削除する。

- [ ] **Step 2: `projectNdlSearchOpenSearchXml` を参照しているテストを更新**

`tests/ndlSearch.adapter.test.ts` の OpenSearch XML fixture を使ったテスト（`search-response.xml`, `record-response.xml`）を SRU fixture に置き換えるか、削除する。

- [ ] **Step 3: `projectOpenSearch.ts` を削除**

```bash
rm src/sources/ndlSearch/projectOpenSearch.ts
```

- [ ] **Step 4: `lib/xml.ts` の `projectOpenSearchXml` が参照されていないか確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && grep -r "projectOpenSearchXml" src/ tests/
```

参照がなければ `lib/xml.ts` から `projectOpenSearchXml` 関数と `OpenSearchXmlProjection` 型を削除する。

- [ ] **Step 5: 全テストが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm test 2>&1 | tail -20
```

- [ ] **Step 6: ビルドが通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm run build 2>&1 | tail -20
```

- [ ] **Step 7: smoke check が通ることを確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && npm run smoke:mcp 2>&1 | tail -20
```

- [ ] **Step 8: live smoke check で実 API 疎通を確認**

```bash
cd J:/apps/ndl-jp-lit-mcp && $env:SMOKE_LIVE="1"; npm run smoke:mcp 2>&1 | tail -30
```

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "chore: remove OpenSearch parser, complete SRU migration"
```

---

## 完了チェックリスト

- [ ] `npm test` 全件通過
- [ ] `npm run build` 通過
- [ ] `npm run smoke:mcp` 通過
- [ ] `SMOKE_LIVE=1 npm run smoke:mcp` で ndl_catalog / ndl_articles / ndl_digital の live 疎通確認
- [ ] `jp_lit_search` レスポンスに `facets` フィールドが含まれる
- [ ] `sort_by=title&sort_order=desc` で結果順序が変わる（live 確認）
- [ ] `projectOpenSearch.ts` が削除されている
- [ ] README の環境変数セクションを更新（`NDL_SEARCH_BASE_URL` → SRU URL に変更する旨を追記）

---

## 注意事項

- **Task 0 が最重要。** dcndl_v3 の実際のフィールド名が不明なまま Task 2 以降を進めると手戻りが大きい。
- ndlDigital の `mapNdlDigitalSearchResponse` は独自の provider ID 判定ロジックを持つ可能性がある。Task 4 で `src/sources/ndlDigital/mapSearch.ts` を読み、`projectNdlSruSearchResponse` が返す shape に必要なフィールドがすべて含まれているか確認すること。
- 横断検索では CiNii / J-STAGE / Japan Search は独自 API を使うため変更なし。
- `getRecord` は SRU ではなく引き続き `bib/external/search` JSON API を使う（変更なし）。
- `NDL_SEARCH_BASE_URL` 環境変数を OpenSearch URL で設定している既存ユーザーへの配慮として、adapter 内で `/opensearch` → `/sru` の URL 正規化を入れておく（Task 3 Step 3 参照）。
