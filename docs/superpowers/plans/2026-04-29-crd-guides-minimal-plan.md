# CRD Guides Minimal Integration Plan

## 目的

レファレンス協同データベース（CRD）のうち、まずは次の2種類を `ndl-jp-lit-mcp` に最小構成で統合する。

- 調べ方マニュアル
- レファレンス事例

ただし、既存の書誌検索系とは混ぜず、調査支援系の独立ツールとして入れる。

---

## 命名方針

将来のグループ化と切り出しを見据えて、次のツール名を採用する。

- `jp_lit_search_guides_manuals`
- `jp_lit_search_guides_cases`

理由:

- 既存の `jp_lit_search_*` 規則を維持できる
- `guides` というまとまりを先に出せる
- `manuals` / `cases` で下位分類できる
- 将来 `collections` や `profiles` を足す余地がある

---

## なぜ `jp_lit_search` に混ぜないか

- 書誌・論文・OCR 系とは結果の意味が違う
- `SearchItem` に無理やり寄せると情報が痩せる
- 利用者が「これは本の候補なのか、調査ガイドなのか」を見分けにくくなる

したがって、専用 schema と専用ツールにする。

---

## ツールの役割

### `jp_lit_search_guides_manuals`

返すもの:

- 調べ方マニュアル
- 特定テーマやトピックの調査方法
- 参考資料や探索ルートの手がかり

使いどころ:

- `何で調べればいいかわからない`
- 調査の入口を知りたい
- 参考資料や索引類の使い方を知りたい

### `jp_lit_search_guides_cases`

返すもの:

- レファレンス事例
- 類似質問
- 回答プロセス
- 参考資料

使いどころ:

- ピンポイントの類似事例がありそう
- 回答に至る調査の流れを知りたい
- 書誌検索が行き詰まり、別の探索手がかりが欲しい

---

## MCP と Skill の分担

### MCP 側

- CRD API へ問い合わせる
- 必要なフィールドだけを構造化して返す
- 書誌系とは別 schema で返す

### Skill 側

- どちらのツールを使うか決める
- `manuals` / `cases` を一次情報そのものではなく「次の一手の材料」として読む
- 結果から次の source や query を作る

---

## schema 方針

既存の `SearchItem` / `RecordItem` は使わない。

### manuals 用の最小出力イメージ

```json
{
  "query": "常陸国風土記",
  "total": 1,
  "items": [
    {
      "id": "crd-manual-123",
      "title": "『常陸国風土記』について調べるには",
      "summary": "特定テーマについて、どの資料や情報源を使って調べるかを案内する",
      "provider": "茨城県立歴史館",
      "url": "https://...",
      "guide_sources": ["参考図書", "目録", "データベース"],
      "raw": {}
    }
  ]
}
```

### cases 用の最小出力イメージ

```json
{
  "query": "世界線 語源",
  "total": 1,
  "items": [
    {
      "id": "crd-case-456",
      "title": "「世界線」という言葉の語源は何か",
      "question": "「世界線」という言葉の語源は何か。なぜ使われるようになったのか。",
      "answer_summary": "用例と参考資料の概要",
      "provider": "京都府立高等学校図書館協議会司書部会",
      "url": "https://...",
      "reference_sources": ["参考資料A", "参考資料B"],
      "raw": {}
    }
  ]
}
```

---

## 実装の最小範囲

### 1. source / adapter

- `src/sources/crd/adapter.ts`
- API 2.0 を使う
- まずは `manual` と `reference` の検索だけ

### 2. schema

- `guidesManualsInputSchema`
- `guidesManualsOutputSchema`
- `guidesCasesInputSchema`
- `guidesCasesOutputSchema`

### 3. tools

- `src/tools/jpLitSearchGuidesManuals.ts`
- `src/tools/jpLitSearchGuidesCases.ts`

### 4. server 登録

- `src/server.ts` に2ツール追加

### 5. tests

- adapter mapping test
- tool schema test
- smoke manifest update

---

## 既定横断検索との関係

- `jp_lit_search` の source 未指定横断には含めない
- `jp_lit_search(source=...)` にも混ぜない
- 調査支援が必要なときだけ、専用ツールとして呼ぶ

---

## 実装順

1. CRD API 2.0 の最小 adapter
2. manuals 用 schema / tool
3. cases 用 schema / tool
4. server 登録
5. tests / smoke 更新
6. Skill 側で `research_guide` intent からの使いどころを追記

---

## 最終方針

- まずは `調べ方マニュアル` と `レファレンス事例`
- 既存の書誌検索とは分離
- 専用ツール
- 専用 schema
- 将来は `guides` グループとして独立 MCP へ切り出せる形で実装する
