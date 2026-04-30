---
name: jp-lit-verification
description: >-
  日本語文献の実在性調査スキル。貼り付けた文章に登場する日本語文献候補を抽出し、
  ndl_search を第一関門として、実在確認済み / 部分一致 / 非実在の疑い / 混線の疑い を根拠付きで判定する。
  「文献検証で」「文献実在性調査を始めます」「この文章に出てくる文献の実在性を確認して」などで使用する。
  一度発火したらセッション中は継続する。
---

# 日本語文献実在性調査スキル（jp-lit-verification）

このスキルは、貼り付けた文章に含まれる日本語文献候補の実在性と書誌整合性を検証する。
主入力は、他サービスや他セッションから持ち込まれた回答文・会話ログ・参考文献一覧である。

## 原則

- 主入力は貼り付け文章
- 文献候補は広めに拾う
- 判定は厳しめに行う
- 主出力は表
- 各行に根拠付きの判定理由を必ず付ける
- `ndl_search` を一次検証の第一関門に使う
- `部分一致` / `混線の疑い` / 再確認価値の高い `非実在の疑い` だけ、必要なら個別 source で再確認する

## フロー

1. 貼り付け文章を受け取る
2. 文献候補を抽出する
3. `jp_lit_search(source=ndl_search, query=...)` で一次検証する
4. 必要なら個別 source で再確認する
5. 表で報告する

## 判定カテゴリ

- 実在確認済み
- 部分一致
- 非実在の疑い
- 混線の疑い

## 出力

主出力は表にする。

| 抽出文献 | 推定タイプ | 検証結果 | 判定理由 | 一致した根拠 | 不一致点 | 確認候補 | 次の手 |
|----------|------------|----------|----------|--------------|----------|----------|--------|

別枠:

## 文献候補として弱い抽出

- 情報が少なすぎる
- 作品名か文献名か判別しにくい
- 文献候補としては弱いが、抽出対象にはなった

## 利用ツール

- 一次検証:
  - `jp_lit_search(source=ndl_search, query=...)`
- 必要なら個別 source で再確認:
  - 図書: `ndl_catalog` / `cinii_books`
  - 論文: `cinii_articles` / `jstage_articles` / `ndl_articles`
  - 一次資料: `ndl_digital`

## 詳細リファレンス

- [workflows/pasted-text-verification.md](workflows/pasted-text-verification.md)
- [heuristics/extraction-rules.md](heuristics/extraction-rules.md)
- [heuristics/classification-rules.md](heuristics/classification-rules.md)
- [heuristics/source-followup.md](heuristics/source-followup.md)
