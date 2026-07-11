# jp-lit-mcp アーキテクチャ解説 HTML 設計

## 目的

TypeScript の基礎を理解している読者が、`jp-lit-mcp` の実コードを自力で追い、新しい source adapter または MCP tool を追加できるところまで理解するための、自己完結型の日本語解説ページを作る。主用途は作者自身の参照だが、公開しても初見の開発者が理解できる内容にする。

## 読者と到達点

- TypeScript の型、関数、`async/await`、module import は理解している。
- MCP SDK、Zod、stdio transport、adapter pattern、依存注入は未経験でもよい。
- 読了後に、CLI から tool response までの処理経路を説明できる。
- `SourceAdapter` の実装と登録箇所、tool の schema・factory・server 登録箇所を特定できる。
- cache と session history の責務の違い、cross-source search の部分失敗戦略を説明できる。

## 成果物

`docs/architecture-guide/` に次の4ファイルを置く。

- `index.html`: 日本語本文、意味構造、コード例、インライン SVG
- `styles.css`: 編集的な紙面、レスポンシブ、印刷、アクセシビリティ
- `app.js`: 章ナビゲーション、処理図の選択、コード注釈、用語フィルター
- `README.md`: ローカル閲覧方法と保守上の注意

外部 CDN、framework、画像、font に依存しない。ファイルを直接開いても、静的ホスティングでも動作する。

## 情報設計

1. Hero: この MCP の役割と読了後に分かること
2. Framework map: Node.js、MCP SDK、TypeScript ESM、Zod、Vitest の担当範囲
3. Architecture SVG: Host → stdio → Server → Tool → Service → Adapter → API、および cache/session の分岐
4. One search journey: `jp_lit_search` の1回を `src/index.ts` から response まで追跡
5. Layer anatomy: composition root、tool、service、adapter、mapper、persistence
6. Design decisions: factory、dependency injection、共通 interface、`Promise.allSettled`、round-robin merge、partial failure
7. Cache vs session: 同一入力の再利用と調査履歴を分離する理由
8. Extension recipes: source と tool の追加手順
9. Testing map: unit、fixture、service、MCP smoke の役割
10. Reading routes: 15分、60分、実装着手の順路

## 表現方針

- 実コードから短い断片を引用し、説明対象のファイル path を明示する。
- version や tool 数のように変化しやすい情報を主役にせず、構造的な契約を中心にする。
- MCP framework と repo 固有ロジックを混同しない。SDK が提供する transport / registration と、repo が実装する tool / service / adapter を分けて示す。
- `server.ts` は composition root として説明し、大きさを隠さず「依存を組み立てる場所」という役割を示す。
- source adapter と dedicated client の両方があることを説明する。

## ビジュアル設計

研究ノートと回路図を組み合わせた編集的デザイン。生成りを背景、濃紺を本文、朱色を主要経路、青緑を persistence に用いる。見出しは serif、本文とコードは system font / monospace とし、外部 font は使わない。カードの羅列ではなく、余白、罫線、欄外番号、縦の読書導線で構成する。

## インタラクション

- sticky な章ナビゲーションで現在位置を示す。
- SVG の各 layer をクリックまたはキーボード選択すると、対応説明を表示する。
- 「検索経路」「永続化」「framework」の3視点で図の強調対象を切り替える。
- コード注釈はボタンで対象行の説明を切り替える。
- motion は `prefers-reduced-motion` を尊重する。
- JavaScript 無効時も全文と図の基本情報を読める。

## 検証

- Vitest で成果物4ファイルの存在、必須章、主要 path、SVG のアクセシブル名、JS hook を検証する。
- `npm test` と `npm run build` を実行する。
- ローカル HTTP server とブラウザで desktop / mobile を目視し、console error、横 overflow、keyboard focus を確認する。
- HTML 内の repo path と説明を現行実装に照合する。

## 非対象

- 全 tool / source の網羅的 API reference
- build tool や frontend framework の追加
- MCP server 本体のリファクタリング
- GitHub Pages の deploy 設定
