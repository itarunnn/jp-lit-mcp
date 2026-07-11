# jp-lit-mcp アーキテクチャガイド

TypeScript の基礎を理解している読者向けに、この MCP の構造と実装経路を説明する自己完結型 HTML です。

## 閲覧

手軽に見る場合は `index.html` を直接ブラウザで開けます。ローカル server を使う場合は repo root で次を実行します。

```powershell
npx serve docs/architecture-guide
```

外部 CDN や画像には依存していません。

## 保守

本文中の file path、関数名、処理説明は現行コードに基づいています。MCP tool の登録方法、`SourceAdapter`、検索・cache・session の責務を変更した場合は、次のファイルと照合してください。

- `src/server.ts`
- `src/tools/jpLitSearch.ts`
- `src/services/searchService.ts`
- `src/sources/types.ts`
- `src/lib/persistence/runCachedTool.ts`

構造要件は `tests/architectureGuide.test.ts` で検証します。
