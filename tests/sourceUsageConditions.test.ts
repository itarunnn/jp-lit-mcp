import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("source usage conditions memo", () => {
  it("documents the implementation-sensitive usage boundaries", () => {
    const memo = readFileSync("docs/source-usage-conditions.md", "utf8");
    const reference = readFileSync("docs/reference.md", "utf8");
    const docs = `${memo}\n${reference}`;

    expect(memo).toContain("法的助言ではありません");
    expect(memo).toContain("利用者が自分の端末で MCP サーバーを動かし");
    expect(memo).toContain("J-STAGE の記事ページ HTML");
    expect(memo).toContain("24 時間以上保存・キャッシュしない");
    expect(memo).toContain("利用者運営サービス");
    expect(memo).toContain("ミラー");
    expect(memo).toContain("IRDB 詳細画面 HTML");
    expect(memo).toContain("WEKO3 JSON API");
    expect(memo).toContain("利用者向け API 仕様書");
    expect(memo).toContain("nihonbungaku_metadata");
    expect(memo).toContain("NIHONBUNGAKU_METADATA_API_KEY");
    expect(memo).toContain("外部システムとの連携向け検索 API");
    expect(memo).toContain("個人運営");
    expect(memo).toContain("LLM 生成メタデータ");
    expect(memo).toContain("未許諾のまま公開 JSON を自動取得する adapter は実装しない");

    expect(reference).toContain("J-STAGE 記事 HTML meta");
    expect(reference).toContain("J-STAGE 記事ページ HTML 詳細");
    expect(reference).toContain("J-STAGE 記事ページ HTML の `citation_*` meta");
    expect(reference).toContain("標準的な想定は、利用者が自分の端末で調査を継続するためのローカルキャッシュ");
    expect(docs).not.toContain("| `jstage_articles` | J-STAGE WebAPI | J-STAGE WebAPI |");
  });
});
