---
name: jp-lit-iiif
description: Use when the user wants IIIF image comparison, page or region curation, local kuzushiji OCR, or multimodal reading of selected IIIF material with provenance.
metadata:
  short-description: "IIIF資料の比較と出典付き画像読解"
---

# IIIF資料の比較と画像読解

選んだ資料のページ・矩形をローカル比較画面で記録し、画像と出典を既存AIアプリへ渡す。CLI呼び出し、要求JSON、再開、テキスト併読は[workflow](references/workflow.md)を必要な段階で読む。

通常の依頼例は「選択した2画像を比べ、見える違いと翻刻候補を出典付きで示す」。資料探索が必要なら既存jp-litの検索・詳細からmanifest候補を選ぶ。国書DBは`source_metadata.manifest_url`、Japan Searchは`source_metadata.iiif_url`、NDLの公開PID由来URLは取得まで候補として扱う。

読解は`evidence.json`と実際に開けた画像を入力とする。各観察・翻刻候補・解釈へ`evidence_id`を付け、疑義と`ai_candidate`状態を`analysis.json` / `analysis.md`へ保存する。原テキストは元のまま保持し、候補と校合記録を別に残す。画像未取得の領域はテキスト／metadataの読解範囲を示す。

既存テキストがあれば画像と併読する。細字の疑義が残る場合は必要な範囲を選び直す。TEI画像対応はCLIのhelpに`link_tei`がある開発版で使う。固定XMLの原構造・hash・locatorを保持し、画像への対応と本文校合を別に記録する。詳細はworkflowのTEI連携を読む。

ローカルくずし字OCRはhelpに`run_ocr`がある版で、利用者が任意導入したNDL古典籍OCR-Liteを使う。[workflowのOCR連携](references/workflow.md#ローカルくずし字ocr開発版)でproviderの固定、実行、import、失敗時の原出力保全を確認する。OCR原文・修訂候補・校合記録を分け、機械出力から校合済みへ自動昇格させない。engine未導入なら導入方法を示す。公開OCRサービスや外部モデルへの接続は、利用者による明示設定と資料別許可を具体化する後続段階である。

読解結果の確認にはworkspaceを再開し、同じ領域IDの「元の場所へ戻る」を使う。機械読解の完了と原資料との照合を別の状態として報告する。
