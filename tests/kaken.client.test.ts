import { describe, expect, it, vi } from "vitest";

import { createKakenClient } from "../src/sources/kaken/client.js";

const SEARCH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<grantAwards>
  <totalResults>2</totalResults>
  <startIndex>1</startIndex>
  <itemsPerPage>2</itemsPerPage>
  <grantAward id="KAKENHI-PROJECT-19K20626" awardNumber="19K20626">
    <urlList>
      <url>https://kaken.nii.ac.jp/grant/KAKENHI-PROJECT-19K20626/</url>
    </urlList>
    <summary xml:lang="ja">
      <title>IIIFとTEIを用いたオンライン翻刻支援システムの開発</title>
      <category niiCode="252">若手研究</category>
      <member sequence="1" eradCode="80802743" role="principal_investigator">
        <institution>東京大学</institution>
        <department>史料編纂所</department>
        <personalName><fullName>中村 覚</fullName></personalName>
        <enriched><researcherNumber type="erad">80802743</researcherNumber></enriched>
      </member>
      <keywordList>
        <keyword sequence="1">IIIF</keyword>
        <keyword sequence="2">人文情報学</keyword>
      </keywordList>
      <periodOfAward>
        <startDate>2019-04-01</startDate>
        <endDate>2023-03-31</endDate>
      </periodOfAward>
      <paragraphList>
        <paragraph sequence="1">研究概要本文</paragraph>
      </paragraphList>
    </summary>
  </grantAward>
  <grantAward id="KAKENHI-PROJECT-19K20239" awardNumber="19K20239">
    <urlList>
      <url>https://kaken.nii.ac.jp/grant/KAKENHI-PROJECT-19K20239/</url>
    </urlList>
    <summary xml:lang="ja">
      <title>Web上のAPI利用例に対する情報の鮮度を判定する整合性検査手法の開発</title>
      <category>若手研究</category>
      <member role="principal_investigator">
        <institution>大阪大学</institution>
        <personalName><fullName>神田 哲也</fullName></personalName>
      </member>
    </summary>
  </grantAward>
</grantAwards>`;

const DETAIL_HTML = `<!doctype html>
<html>
  <head>
    <meta name="description" content="研究代表者：中村 覚, 研究期間 (年度)：2019-04-01 – 2023-03-31, 研究種目：若手研究" />
    <meta name="citation-pdf-url" content="https://kaken.nii.ac.jp/file/KAKENHI-PROJECT-19K20626/19K20626seika.pdf" />
  </head>
  <body>
    <table>
      <tr><th>審査区分/研究分野</th><td>人文情報学 / 日本史</td></tr>
      <tr><th>キーワード</th><td>IIIF / TEI / 翻刻</td></tr>
      <tr><th>研究成果の概要</th><td><p>研究成果概要です。</p></td></tr>
    </table>
    <h2>報告書</h2>
    <a href="/ja/file/KAKENHI-PROJECT-19K20626/19K20626seika.pdf">研究成果報告書</a>
    <h4>[雑誌論文] IIIFとTEIを用いた研究<span class="pull-right year">2022</span></h4>
    <div>
      <h5>著者名/発表者名</h5><div>中村 覚, 山田 太郎</div>
      <h5>DOI</h5><div>10.1234/example</div>
      <h5>オープンアクセス</h5><div><a href="https://example.org/paper">あり</a></div>
    </div>
    <h4>[学会発表] 翻刻支援システムの発表<span class="pull-right year">2021</span></h4>
    <div>
      <h5>著者名/発表者名</h5><div>中村 覚</div>
    </div>
  </body>
</html>`;

const SEARCH_XML_WITH_LOCALIZED_SUMMARIES = `<?xml version="1.0" encoding="UTF-8"?>
<grantAwards>
  <totalResults>1</totalResults>
  <startIndex>1</startIndex>
  <itemsPerPage>20</itemsPerPage>
  <grantAward id="KAKENHI-PROJECT-25K04084" awardNumber="25K04084">
    <urlList>
      <url>https://kaken.nii.ac.jp/grant/KAKENHI-PROJECT-25K04084/</url>
    </urlList>
    <summary xml:lang="ja">
      <title>言語データ連結システムの開発</title>
      <category>基盤研究(C)</category>
      <member sequence="1" eradCode="70578369" role="principal_investigator">
        <institution>筑波大学</institution>
        <department>図書館情報メディア系</department>
        <personalName><fullName>永井 正勝</fullName></personalName>
        <enriched><researcherNumber type="erad">70578369</researcherNumber></enriched>
      </member>
      <keywordList>
        <keyword sequence="1">IIIF</keyword>
      </keywordList>
    </summary>
    <summary xml:lang="en">
      <title>Development of a linked language data system</title>
      <category>Grant-in-Aid for Scientific Research (C)</category>
    </summary>
  </grantAward>
</grantAwards>`;

describe("kaken client", () => {
  it("OpenSearch XML と詳細 HTML を軽量な研究課題ヒントに正規化する", async () => {
    const fetcher = vi.fn(async (url: URL) => {
      if (url.pathname.includes("/opensearch")) {
        return { text: SEARCH_XML, contentType: "application/xml" };
      }
      return { text: DETAIL_HTML, contentType: "text/html; charset=utf-8" };
    });
    const client = createKakenClient({ appId: "test-app", fetcher });

    const result = await client.searchProjects({
      query: "IIIF",
      limit: 2,
      page: 1,
      detail_limit: 1,
      include_outputs: true
    });

    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({
      project_id: "19K20626",
      title: "IIIFとTEIを用いたオンライン翻刻支援システムの開発",
      principal_investigator: {
        name: "中村 覚",
        affiliation: "東京大学 史料編纂所",
        researcher_number: "80802743"
      },
      fiscal_years: "2019-04-01 - 2023-03-31",
      project_type: "若手研究",
      keywords: ["IIIF", "TEI", "翻刻"],
      detail_fetched: true,
      report_pdf_status: "found"
    });
    expect(result.items[0].report_pdfs).toEqual([
      {
        label: "研究成果報告書",
        fiscal_year: null,
        url: "https://kaken.nii.ac.jp/file/KAKENHI-PROJECT-19K20626/19K20626seika.pdf"
      }
    ]);
    expect(result.items[0].outputs_preview[0]).toMatchObject({
      type: "journal_article",
      raw_type: "雑誌論文",
      title: "IIIFとTEIを用いた研究",
      authors: ["中村 覚", "山田 太郎"],
      year: "2022",
      doi: "10.1234/example",
      url: "https://example.org/paper"
    });
    expect(result.items[1]).toMatchObject({
      project_id: "19K20239",
      detail_fetched: false,
      detail_omitted_reason: "detail_limit_exceeded",
      report_pdf_status: "not_checked"
    });
    expect(result.items[0].search_hints.caution).toContain("CiNii / J-STAGE / IRDB / NDL");
  });

  it("KAKEN API の rw は許容値へ丸めつつ返却件数は limit で絞る", async () => {
    const fetcher = vi.fn(async (url: URL) => {
      if (url.pathname.includes("/opensearch")) {
        return { text: SEARCH_XML, contentType: "application/xml" };
      }
      return { text: DETAIL_HTML, contentType: "text/html; charset=utf-8" };
    });
    const client = createKakenClient({ appId: "test-app", fetcher });

    const result = await client.searchProjects({
      query: "IIIF",
      limit: 1,
      page: 1,
      detail_limit: 0,
      include_outputs: false
    });

    const searchUrl = fetcher.mock.calls[0]?.[0];
    expect(searchUrl).toBeInstanceOf(URL);
    expect(searchUrl?.searchParams.get("rw")).toBe("20");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.project_id).toBe("19K20626");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("live XML の複数 summary から日本語 summary を選んで正規化する", async () => {
    const fetcher = vi.fn(async (url: URL) => {
      if (url.pathname.includes("/opensearch")) {
        return { text: SEARCH_XML_WITH_LOCALIZED_SUMMARIES, contentType: "application/xml" };
      }
      return { text: DETAIL_HTML, contentType: "text/html; charset=utf-8" };
    });
    const client = createKakenClient({ appId: "test-app", fetcher });

    const result = await client.searchProjects({
      query: "IIIF",
      limit: 1,
      page: 1,
      detail_limit: 0,
      include_outputs: false
    });

    expect(result.items[0]).toMatchObject({
      project_id: "25K04084",
      title: "言語データ連結システムの開発",
      project_type: "基盤研究(C)",
      principal_investigator: {
        name: "永井 正勝",
        affiliation: "筑波大学 図書館情報メディア系",
        researcher_number: "70578369"
      },
      keywords: ["IIIF"]
    });
  });

  it("CINII_RESEARCH_APP_ID がない場合は明確に失敗する", async () => {
    const client = createKakenClient({ appId: "" });

    await expect(
      client.searchProjects({
        query: "IIIF",
        limit: 1,
        page: 1,
        detail_limit: 0,
        include_outputs: true
      })
    ).rejects.toThrow("CINII_RESEARCH_APP_ID");
  });
});
