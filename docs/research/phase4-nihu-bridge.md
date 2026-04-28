# Phase 4: nihu_bridge — 調査レポート

**調査日:** 2026-04-27
**調査者:** GSD Research Agent
**対象:** NIHU（人間文化研究機構）傘下・関連機関のDB横断検索 source 実装調査

---

## 結論サマリ

**実装推奨:** `nihu_bridge` source として **nihuBridge 統合検索 API** (`api.bridge.nihu.jp`) を採用する。

- 認証不要・公開 REST API（POST JSON）
- NIHU 傘下 7 機関（国文研・歴博・国語研・日文研・地球研・民博 + 機構直轄）合計 100+ DB を横断検索
- 異体字同定検索（`normalize: true`）が API パラメータ一つで実現できる
- 時間範囲検索（`temporal` + `BETWEEN` 演算子、ISO8601形式）が動作確認済み
- 空間検索（`spatial` + 緯度経度 bounding box、`(lat1,lon1),(lat2,lon2)` 形式）が動作確認済み
- `source_id` = `researchResourceId`（数値文字列、全 DB を通じて一意）

---

## 1. NIHU傘下機関DB一覧と API 有無

### 1.1 nihuBridge 統合検索 API（公式公開、認証不要）

**出典:** [nihuBridge 統合検索機能 利用者向け API 仕様書 Ver1.0](https://www.nihu.jp/files/site/doc/mid4/nihuBridge_API_specification.pdf)（2022年7月20日）

nihuBridge は NIHU 傘下 6 機関 + 機構直轄 DB を横断検索する統合 API。認証キー不要、公開アクセス可能。

#### 機関 ID 一覧（PDF Appendix より）

| 機関ID | 機関名 |
|--------|--------|
| nihu | 人間文化研究機構（機構直轄） |
| nmjh | 国立歴史民俗博物館（歴博） |
| nijl | 国文学研究資料館（国文研） |
| ninjal | 国立国語研究所（国語研） |
| ircjs | 国際日本文化研究センター（日文研） |
| rihn | 総合地球環境学研究所（地球研） |
| nme | 国立民族学博物館（民博） |

#### 代表的な機関データベース（`database_original_id`）

**国文研 (nijl):**
- `nijl_nihonkotenseki` — 日本古典籍総合目録
- `nijl_genjimonogatari` — 絵入源氏物語
- `nijl_kokubungakuronbun` — 国文学論文目録
- `nijl_kojiruien` — 古事類苑
- `nijl_kohitugire` — 古筆切所収情報
- `nijl_21daisyuu` — 二十一代集
- `nijl_azumakagami` — 吾妻鏡
- `nijl_history` — 歴史物語
- `nijl_rekisijinbutu` — 歴史人物画像
- `nijl_ir` — 国文学研究資料館学術情報リポジトリ
- その他多数（全 21+ DB）

**歴博 (nmjh):**
- `nmjh_kanzousiryou` — 館蔵資料（49,769件確認）
- `nmjh_kanzoucyuusei` — 館蔵中世古文書
- `nmjh_tosyomokuroku` — 歴博図書目録
- `nmjh_ir` — 学術情報リポジトリ
- その他（全 30+ DB、遺跡・錦絵・武具等）

**国語研 (ninjal):**
- `ninjal_shinbun` — ことばに関する新聞記事見出し
- `ninjal_toshokanmokuroku` — 蔵書目録（図書）
- `ninjal_nihongokenkyuu_nihongokyoiku` — 日本語研究・日本語教育文献
- `ninjal_beikokugikaitoshokangenji` — 米国議会図書館本源氏物語翻字本文
- `ninjal_ir` — 学術情報リポジトリ
- その他（方言文法地図、日本言語地図 等）

**日文研 (ircjs):**
- `ircjs_kaiiyoukaidensyou` — 怪異・妖怪伝承
- `ircjs_emakimono` — 絵巻物
- `ircjs_waka` — 和歌
- `ircjs_renga` — 連歌
- `ircjs_haikai` — 俳諧
- `ircjs_ukiyoe` — 米国議会図書館所蔵浮世絵
- `ircjs_heianjinbutusi_database` — 平安人物志（座標付き）
- `ircjs_ir` — 日文研オープンアクセス
- その他（全 21+ DB）

**民博 (nme):**
- `nme_mocat` — 標本資料目録
- `nme_mofull` — 標本資料詳細情報
- `nme_mobib` — 標本資料記事索引
- `nme_audcat` — 音響資料目録
- `nme_movcat` — 映像資料目録
- `nme_lib_books` — 図書目録
- `nme_ir` — みんぱくリポジトリ
- その他（京大調査隊写真、コレクション等）

**地球研 (rihn):**
- `rihn_syozoutosyo` — 所蔵図書
- `rihn_archives` — 地球研アーカイブス
- `rihn_ir` — 学術情報リポジトリ

**機構直轄 (nihu):**
- `nihu_cw01` — 東洋文庫・中華教育界目録
- `nihu_atoingashu` — 亜東印画輯
- `G0000003KK01` — 縄文集落データベース
- `G0000003EMP01` — 幕末明治地図
- その他

---

## 2. nihuBridge 統合検索 API 仕様

### 2.1 エンドポイント一覧

| 機能 | メソッド | URL |
|------|---------|-----|
| メタデータ検索 | POST | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search` |
| メタデータ検索(HIT数) | POST | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search-hits` |
| メタデータ取得 | GET / POST | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/{researchResourceId}` |

### 2.2 認証

**認証不要。** API キー不在。2026-04-27 時点での動作確認では Rate limit に関する HTTP ヘッダも観測されなかったが、実装時はリクエスト間隔に配慮すること。

### 2.3 検索リクエスト JSON 仕様

```typescript
interface NihuBridgeSearchRequest {
  institute?: string[];        // 機関IDフィルター: ["nijl", "nmjh", ...]
  database?: string[];         // DBフィルター: ["nijl_nihonkotenseki", ...]
  groupByDatabase?: boolean;   // true: DB別ヒット数でソート
  query: {
    conditions: Array<{
      connect: "AND" | "OR";   // 最初の condition は必須でも AND/OR 指定
      negation?: boolean;      // true: 否定条件
      query?: {                // query または queries のどちらか一方
        field?: string;        // 省略時: 全フィールド対象
        term: string;          // 検索語
        operator?: "LE" | "GE" | "BETWEEN";  // int/numeric/date 型のみ有効
        match?: "start" | "contain" | "end" | "is" | "regex";
        normalize?: boolean;   // 異体字同定（デフォルト: true）
        negation?: boolean;    // クエリ単位の否定
      };
      queries?: Array<{...}>;  // 複数クエリのグループ
    }>;
    paging: {
      start: number;           // 開始位置（0始まり）
      size: number;            // 取得件数（上限は仕様書に「研究資源ドメイン単位の上限」とのみ記載、実測で 1000 まで確認）
    };
    sort?: Array<{
      field: string;
      order: "asc" | "desc";
    }>;
  };
  fields?: string[];           // レスポンスに含めるフィールド名リスト
}
```

### 2.4 主要フィールド名（`field` に指定可能）

| フィールド | 説明 |
|-----------|------|
| `title` | タイトル |
| `alternativeTitle` | 別タイトル |
| `creator` | 作成者 |
| `contributor` | 編者・監修者 |
| `publisher` | 所蔵者・組織 |
| `subject` | 主題 |
| `keyword` | キーワード |
| `description` | 概要・説明 |
| `temporal` | 対象時間範囲（ISO8601 datetime または BETWEEN 演算子） |
| `spatial` | 対象空間範囲（geolocation: `(lat1,lon1),(lat2,lon2)` 形式） |
| `datePublished` | 登録日 |
| `researchResourceId` | 研究資源ID |
| `originalId` | オリジナルID |
| `inLanguage` | 言語 |
| `type` | 研究データのタイプ |
| `link` | 研究データへのリンク |

### 2.5 検索レスポンス JSON 構造

```typescript
interface NihuBridgeSearchResponse {
  info: {
    statusCode: 0 | 99;        // 0: 成功, 99: 失敗
    total: number;             // 検索結果総数
    databases?: {              // DBごとのヒット数
      [databaseId: string]: number;
    };
    error?: { title: string; message: string };
  };
  hits: Array<{
    database: string;          // 機関データベースID（例: "nijl_nihonkotenseki"）
    id: string;                // researchResourceId（全DB通じて一意な数値文字列）
    fields: Array<{
      field: string;           // フィールド名
      label: string;           // 日本語フィールド名
      value: unknown;          // フィールド値（null / string / string[] / object[]）
      highlight?: string;      // ハイライト付き値（`<em class="highlight_keyword">` タグ）
    }>;
  }>;
}
```

### 2.6 レコード取得レスポンス

```typescript
interface NihuBridgeRecordResponse {
  info: { statusCode: 0 | 99; total: number };
  researchResource: {
    databaseId: string;
    researchResourceId: string;
    doi: string | null;
    originalId: string[];
    title: string[];
    alternativeTitle: string[] | null;
    creator: string[] | null;
    contributor: string[] | null;
    publisher: string[] | null;
    subject: string[] | null;
    keyword: string[] | null;
    description: string[] | null;
    dateCreated: string[] | null;
    datePublished: string | null;
    temporal: Array<{ description: string[]; date: string }> | null;
    spatial: Array<{ description: string[]; place: string[] }> | null;
    link: Array<{ type: string; link: string }> | null;
    sampleLink: unknown;
    type: string[] | null;
    license: string[] | null;
    inLanguage: string[] | null;
    // ... 他多数
  };
}
```

### 2.7 ページネーション

- `paging.start` でオフセット指定（0始まり）
- `paging.size` で件数指定（実測 1000 まで動作確認）
- 総件数は `info.total` で取得

---

## 3. 異体字検索の実装可能性

### 3.1 nihuBridge の `normalize` パラメータ

**動作確認済み（HIGH 信頼度）。**

`query.conditions[].query.normalize: true`（デフォルト `true`）により異体字同定検索を実施できる。

**実測結果（2026-04-27）:**

| 検索語 | normalize=false | normalize=true (デフォルト) |
|--------|----------------|--------------------------|
| 辨慶（旧字） | 148件 | 4,621件 |
| 弁慶（新字） | 4,482件 | 4,621件（辨慶と同一） |

normalize=true 時に辨・弁が同一視されて統合されていることが確認できる。

### 3.2 MCP への専用引数設計

`normalize: true` はデフォルト動作（仕様書記載）なので、**通常検索は自動的に異体字同定が有効**。

追加引数として `filters.nihu_bridge.normalize: false` を設ければ、異体字同定を明示的にオフにすることも可能。ただし、デフォルトが `true` であるため、明示的な `true` 引数は不要。

### 3.3 国文研 独自の字形検索

- `lab.nijl.ac.jp/jikei/` — 字形検索β（ウェブ UI のみ、プログラムアクセス不可と推定）
- `kokusho.nijl.ac.jp` — 国書DB の異体字検索は PGroonga による内部実装（外部 API なし）
- MCP での実装不可。nihuBridge の `normalize` パラメータで代替。

---

## 4. 時空間検索の実装可能性

### 4.1 時間範囲検索

**動作確認済み（HIGH 信頼度）。**

```json
{
  "connect": "AND",
  "query": {
    "field": "temporal",
    "term": "1600-01-01T00:00:00+09:00,1868-12-31T00:00:00+09:00",
    "operator": "BETWEEN"
  }
}
```

- `term` に `"開始ISO8601,終了ISO8601"` のカンマ区切りで指定
- `operator: "BETWEEN"` を指定
- 実測で江戸時代（1600-1868）絞り込み 19,554件 ヒット

### 4.2 空間検索

**動作確認済み（HIGH 信頼度）。**

```json
{
  "connect": "AND",
  "query": {
    "field": "spatial",
    "term": "(lat1,lon1),(lat2,lon2)"
  }
}
```

- Bounding box 形式：南北東西の2点で矩形を指定
- 例: 京都中心部 `"(35.02,135.68),(34.94,135.79)"` で 1,053件ヒット
- ただし `spatial` フィールドにデータが入っているのは限られた DB のみ（`ircjs_heianjinbutusi_database` 等）
- テキスト地名（「京都」等）での `spatial` 検索はエラー：`"The field must be latitude longitude format"`

### 4.3 MCP 引数設計推奨

```typescript
// jp_lit_search filters.nihu_bridge 案
interface NihuBridgeFilters {
  // 機関フィルター（複数指定可）
  institute?: Array<"nijl" | "nmjh" | "ninjal" | "ircjs" | "rihn" | "nme" | "nihu">;
  // DB直指定
  database?: string[];
  // 異体字同定オフ（デフォルト: 有効）
  normalize?: boolean;
  // 時間範囲（ISO8601 年のみも可: "1600,1868"）
  period_from?: string;
  period_to?: string;
  // 空間検索（bounding box）
  bbox?: {
    lat1: number; lon1: number;
    lat2: number; lon2: number;
  };
}
```

---

## 5. 実装対象 source 一覧

### 5.1 実装する: `nihu_bridge`（単一 source）

nihuBridge 統合 API は全 NIHU 機関を横断検索するので、機関別の source は不要。1 つの `nihu_bridge` source を実装する。

| 機能 | 実装方法 |
|------|---------|
| 検索 | `POST https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search` |
| レコード取得 | `GET https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/{id}` |
| source_id | `researchResourceId`（全DB通じて一意な数値文字列） |
| 異体字検索 | `normalize: true`（デフォルト） |
| 時間範囲 | `field: "temporal"` + `operator: "BETWEEN"` |
| 空間検索 | `field: "spatial"` + bbox 座標 |
| 機関絞り込み | `institute: [...]` |

---

## 6. 実装しない DB と理由

| DB / サービス | 理由 |
|--------------|------|
| 国書データベース（kokusho.nijl.ac.jp）の独自 API | 外部検索 API なし（IIIF Manifest はあるが検索 API 非公開）。nihuBridge 経由の国文研データで代替可能 |
| NINJAL コーパス（少納言・中納言） | 言語コーパス検索（文字列・形態素検索）であり文献検索とは目的が異なる。プログラムアクセス API 非公開。スコープ外 |
| 歴博独自 DB（rekihaku.ac.jp/doc/t-db-index.html） | 一般公開 DB はウェブ UI のみ（CGI 形式、機械的アクセス想定外）。nihuBridge 経由で主要データ（`nmjh_kanzousiryou` 等）にアクセス可能 |
| 民博標本目録（htq.minpaku.ac.jp）独自 API | API 仕様未公開、ウェブ UI のみ。nihuBridge 経由で `nme_mocat` / `nme_mofull` にアクセス可能 |
| Japan Search の NIHU データ（jpsearch.go.jp） | 既に `japan_search` source として実装済み。nihuBridge とデータ重複あり。重複実装を避ける |
| ColBase（colbase.nich.go.jp） | 国立文化財機構（NICH）所蔵。NIHU ではなく別機構。JavaScript 必要な SPA で API 非公開 |
| 東京大学史料編纂所（wwwap.hi.u-tokyo.ac.jp/ships/） | 東大附置研究所、NIHU 外。CGI 形式、機械的アクセス想定外 |
| CODH くずし字データセット | 機械学習用画像データセット（ZIP/JSON-LD）。文献検索 source として適さない |

---

## 7. API 仕様サマリ（実装ガイド）

### 7.1 最小限の検索リクエスト例

```typescript
// POST https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search
const body = {
  query: {
    conditions: [
      {
        connect: "AND",
        query: {
          term: "源氏物語",
          normalize: true  // 異体字同定（デフォルト）
        }
      }
    ],
    paging: {
      start: (page - 1) * limit,
      size: limit
    }
  }
};
```

### 7.2 機関フィルター + 時間範囲絞り込みの例

```typescript
const body = {
  institute: ["nijl"],  // 国文研のみ
  query: {
    conditions: [
      {
        connect: "AND",
        query: { term: "平家物語" }
      },
      {
        connect: "AND",
        query: {
          field: "temporal",
          term: "1185-01-01T00:00:00+09:00,1600-12-31T00:00:00+09:00",
          operator: "BETWEEN"
        }
      }
    ],
    paging: { start: 0, size: 10 }
  }
};
```

### 7.3 レスポンスから SearchItem へのマッピング方針

`hits[].fields` は `{field, label, value}` の配列。`field` 名でルックアップして値を取得する。

```typescript
function getField(fields: NihuField[], name: string): unknown {
  return fields.find(f => f.field === name)?.value ?? null;
}

// title: string[] の最初の要素（"||" 区切りを含む場合あり）
const rawTitle = getField(fields, "title") as string[] | null;
const title = rawTitle?.[0]?.split("||")[0]?.trim() ?? "Untitled";

// creator: string[] | null（"姓名 <NDL_ID>" 形式を含む）
const creatorRaw = getField(fields, "creator") as string[] | null;
const authors = (creatorRaw ?? []).map(c => ({
  name: c.replace(/<[^>]+>/g, "").replace(/\|\|.*$/, "").trim(),
  role: "author"
}));

// temporal: {description: string[], date: string}[] | null
// date は "ISO8601,ISO8601" のカンマ区切り範囲
const temporalRaw = getField(fields, "temporal") as Array<{description:string[], date:string}> | null;
const issued_at = temporalRaw?.[0]?.date?.split(",")?.[0] ?? null;

// link: {type: string, link: string}[] | null
const linkRaw = getField(fields, "link") as Array<{type:string, link:string}> | null;
const url = linkRaw?.[0]?.link ?? null;

// source_id = hit.id（researchResourceId）
const source_id = hit.id;
```

### 7.4 getRecord のマッピング方針

レコード取得レスポンスの `researchResource` フィールドは検索レスポンスとは別スキーマ（フラットなオブジェクト、`fields` 配列でなく直接プロパティ）。

```typescript
const rr = response.researchResource;
const title = rr.title?.[0]?.split("||")[0]?.trim() ?? "Untitled";
const creator = rr.creator ?? [];
const description = rr.description?.[0] ?? null;
const temporal = rr.temporal?.[0]; // { description, date }
const spatial = rr.spatial?.[0];   // { description, place }
const url = rr.link?.[0]?.link ?? null;
```

---

## 8. 実装上の注意点

### 8.1 POST メソッド必須

検索 API は POST（JSON body）。`fetchJson()` に相当するが `Content-Type: application/json` と body 送信が必要。既存の `fetchJson()` ヘルパーは GET 想定の可能性があるため、`fetchJson(url, {method: "POST", body: JSON.stringify(body)})` の形式を確認すること。

### 8.2 `fields` 配列のルックアップ

検索レスポンスの各 hit の `fields` は **配列**（オブジェクトマップでない）。`find(f => f.field === "title")` でフィールドを探す必要がある。キーアクセス不可。

### 8.3 `getRecord` の GET vs POST

仕様書には GET と POST 両対応と記載。実測では GET で取得確認済み。adapter では GET を使用する（既存パターンと整合）。

### 8.4 `title` の `||` 区切り

title フィールドの各要素に `"タイトル||ヨミ"` 形式が混在する（例: `"武家百人一首||ブケヒャクニンイッシュ"`）。最初の `||` 以前を本タイトルとして使用する。

### 8.5 `temporal.date` の形式

`"1600-01-01T00:00:00+09:00,1868-12-31T00:00:00+09:00"` のカンマ区切り範囲文字列。`issued_at` には開始日を使用する。年のみ精度の場合もあるため、`normalizeIssuedAt()` に渡す前に先頭の ISO8601 をそのまま渡せばよい。

### 8.6 `link` フィールドの NULL 多発

hit の `link` フィールドが `null` の場合が多い（DB によってはリンク情報を持たない）。`url: null` として処理する。

### 8.7 `source_id` の一意性

`researchResourceId`（数値文字列）は全 DB を通じて一意。`source_id` にそのまま使用できる。`{database}-{id}` のような複合キーは不要。

### 8.8 paging の `size` 上限

仕様書には「研究資源ドメイン単位の上限」とのみ記載。実測で 1000 まで動作確認。既存 source に合わせて `limit` の最大は 50 等に絞る方が安全。

### 8.9 既存 japan_search との重複

Japan Search（jpsearch.go.jp）にも `ownerOrg=nihu` の資料が存在するが、`nij16`（日本古典籍総合目録）等の Japan Search 経由データと nihuBridge の `nijl_nihonkotenseki` データは重複する可能性がある。`japan_search` と `nihu_bridge` を同時に横断検索対象にしないよう、`nihu_bridge` も既定横断検索対象外にする。

### 8.10 レート制限

現時点で rate limit ヘッダは観測されなかったが、公開 API のため過剰リクエストは避ける。smoke test でのライブ検証は 1 クエリのみとする。

---

## 9. 推奨実装順序

1. **`nihu_bridge` adapter 基本実装**（検索 + レコード取得）
   - `adapter.ts`: POST JSON 検索、GET レコード取得
   - `mapSearch.ts`: `fields` 配列パース → `SearchItem[]`
   - `mapRecord.ts`: `researchResource` オブジェクト → `RecordItem`

2. **基本検索テスト**（`source=nihu_bridge` + キーワード）
   - fixture: `tests/fixtures/nihu-bridge/search.json`、`record.json`
   - live smoke: `nihu_bridge / 源氏物語`

3. **`filters.nihu_bridge` 追加**（機関絞り込み、normalize、時間範囲、空間）
   - `institute` / `database` / `normalize` / `period_from` + `period_to` / `bbox`
   - source=nihu_bridge 以外で指定すると validation error（irdb と同パターン）

4. **ドキュメント更新**（README.md の source 一覧、引数リファレンス、環境変数）

---

## 10. 環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| `NIHU_BRIDGE_SEARCH_URL` | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas/search` | 検索エンドポイント |
| `NIHU_BRIDGE_RECORD_BASE_URL` | `https://api.bridge.nihu.jp/v1/integratedsearch/metadatas` | レコード取得ベース URL |

---

## 11. ソース・信頼度

| 情報 | ソース | 信頼度 |
|------|--------|--------|
| nihuBridge API エンドポイント | [nihuBridge API 仕様書 PDF](https://www.nihu.jp/files/site/doc/mid4/nihuBridge_API_specification.pdf)（2022年7月） | HIGH |
| 機関 ID・DB 一覧 | 同仕様書 Appendix | HIGH |
| 検索・normalize・temporal・spatial 動作 | 2026-04-27 実際の API 呼び出しで確認 | HIGH |
| 認証不要 | 実測（API キーなしで 200 OK） | HIGH |
| 国書 DB・少納言 等の独自 API 非公開 | 公式サイト調査 + WebSearch | MEDIUM |
| Japan Search の NIHU データ重複 | Japan Search API facet 実測 | HIGH |

---

## 12. 実装しない理由の根拠まとめ

- **国書データベース独自 API:** 公式ページに外部検索 API の記載なし。IIIF Manifest は公開（`kokusho.nijl.ac.jp/biblio/{BID}/manifest`）だが、それは画像閲覧用であり文献検索 source としては不適。国文研データは nihuBridge（`nijl_*` DB 群）経由でアクセス可能。
- **NINJAL コーパス:** 言語コーパス（少納言・中納言）は形態素検索ツールであり、文献書誌検索とは目的が異なる。外部 API 非公開。
- **歴博・民博の独自 CGI DB:** CGI ベースのウェブ UI のみ。nihuBridge 経由で同等データにアクセス可能。
- **CODH くずし字:** 機械学習用データセット（ZIP/画像）。文献メタデータ検索 source ではない。くずし字認識機能は MCP source の設計思想（検索・取得）と合わない。
- **ColBase:** NIHU でなく NICH（国立文化財機構）に属す。Japan Search 経由でアクセス可能。

---

*このレポートは 2026-04-27 の調査結果に基づく。nihuBridge API は 2022年7月の仕様書 Ver1.0 が最新確認版。API 仕様変更の可能性に注意。*
