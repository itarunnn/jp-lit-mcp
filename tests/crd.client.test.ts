import { describe, expect, it, vi } from "vitest";

import { createCrdClient } from "../src/sources/crd/client.js";

const MANUALS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>レファレンス協同データベース</title>
    <item>
      <title>『常陸国風土記』について調べるには(茨城県立歴史館（閲覧室）)</title>
      <link>https://crd.ndl.go.jp/reference/detail?page=man_view&amp;id=2000022249</link>
      <pubDate>Wed, 21 Aug 2013 12:26:46 JST</pubDate>
      <category>常陸国風土記（常陸國風土記）</category>
      <category>NDC:291</category>
      <description>(1) 常陸国風土記とは

《検索する際のキーワード》
風土記／常陸＋風土記／古風土記

【原文（漢文で書かれているもの）を読む】
・『標注 古風土記』

備考:平成25(2013)年は節目の年である。</description>
      <guid>https://crd.ndl.go.jp/reference/detail?page=man_view&amp;id=2000022249</guid>
    </item>
  </channel>
</rss>`;

const CASES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>レファレンス協同データベース</title>
    <item>
      <title>「世界線」という言葉の語源は何か。なぜ使われるようになったのか。(京都府立高等学校図書館協議会司書部会)</title>
      <link>https://crd.ndl.go.jp/reference/detail?page=ref_view&amp;id=1000322589</link>
      <pubDate>Mon, 01 May 2023 14:04:22 JST</pubDate>
      <category>世界線</category>
      <category>NDC:812</category>
      <description>『三省堂国語辞典 第八版』によると、語源はゲーム由来である。

回答プロセス:まず国語辞典を確認したが、収録されていなかった。
次にインターネットを確認した。
事前調査事項:Official髭男dismの歌詞。
参考資料:見坊豪紀ほか編『三省堂国語辞典 第8版』
https://iss.ndl.go.jp/books/R100000002-I031859639-00</description>
      <guid>https://crd.ndl.go.jp/reference/detail?page=ref_view&amp;id=1000322589</guid>
    </item>
  </channel>
</rss>`;

describe("crd client", () => {
  it("調べ方マニュアル RSS を正規化できる", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      text: MANUALS_XML,
      contentType: "text/xml; charset=utf-8"
    });
    const client = createCrdClient({ fetcher });

    const result = await client.searchManuals({ query: "常陸国風土記", limit: 5, page: 1 });

    expect(result.query).toBe("常陸国風土記");
    expect(result.type).toBe("manual");
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "2000022249",
      title: "『常陸国風土記』について調べるには",
      provider: "茨城県立歴史館（閲覧室）",
      url: "https://crd.ndl.go.jp/reference/detail?page=man_view&id=2000022249"
    });
    expect(result.items[0].categories).toEqual([
      "常陸国風土記（常陸國風土記）",
      "NDC:291"
    ]);
    expect(result.items[0].search_keywords).toEqual([
      "風土記",
      "常陸＋風土記",
      "古風土記"
    ]);
    expect(result.items[0].guide_headings).toEqual([
      "原文（漢文で書かれているもの）を読む"
    ]);
  });

  it("レファレンス事例 RSS を正規化できる", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      text: CASES_XML,
      contentType: "text/xml; charset=utf-8"
    });
    const client = createCrdClient({ fetcher });

    const result = await client.searchCases({ query: "世界線", limit: 5, page: 1 });

    expect(result.query).toBe("世界線");
    expect(result.type).toBe("reference");
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "1000322589",
      title: "「世界線」という言葉の語源は何か。なぜ使われるようになったのか。",
      provider: "京都府立高等学校図書館協議会司書部会",
      question: "「世界線」という言葉の語源は何か。なぜ使われるようになったのか。",
      answer_process: "まず国語辞典を確認したが、収録されていなかった。\n次にインターネットを確認した。"
    });
    expect(result.items[0].reference_sources).toEqual([
      "見坊豪紀ほか編『三省堂国語辞典 第8版』"
    ]);
    expect(result.items[0].categories).toEqual(["世界線", "NDC:812"]);
  });
});
