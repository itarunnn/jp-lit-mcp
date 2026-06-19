import { describe, expect, it } from "vitest";

import {
  assessMatchConfidence,
  normalizeDoi,
  normalizeTitleForMatch
} from "../src/sources/externalWork/matching.js";

describe("external work matching", () => {
  it("DOI URL and casing variants normalize to one cacheable DOI", () => {
    expect(normalizeDoi("https://doi.org/10.1234/ABC.Def")).toBe("10.1234/abc.def");
    expect(normalizeDoi("doi:10.1234/ABC.Def")).toBe("10.1234/abc.def");
  });

  it("normalizes title punctuation and spacing without erasing Japanese text", () => {
    expect(normalizeTitleForMatch("『源氏物語』 研究 -- 受容史")).toBe("源氏物語研究受容史");
  });

  it("keeps DOI matches high when other provided fields do not conflict", () => {
    const assessment = assessMatchConfidence(
      {
        doi: "10.1234/genji",
        title: "源氏物語研究",
        authors: ["山田太郎"],
        issued_year: "2020"
      },
      {
        doi: "https://doi.org/10.1234/GENJI",
        title: "源氏物語研究",
        authors: ["山田太郎"],
        issued_year: "2020"
      }
    );

    expect(assessment.match_confidence).toBe("high");
    expect(assessment.reasons).toEqual(
      expect.arrayContaining(["doi_match", "title_match", "year_match", "author_overlap"])
    );
    expect(assessment.caution).toMatch(/本文|重要度/);
  });

  it("surfaces conflicting metadata even when DOI matches", () => {
    const assessment = assessMatchConfidence(
      {
        doi: "10.1234/genji",
        title: "源氏物語研究",
        authors: ["山田太郎"],
        issued_year: "2020"
      },
      {
        doi: "https://doi.org/10.1234/GENJI",
        title: "別タイトル",
        authors: ["佐藤花子"],
        issued_year: "1999"
      }
    );

    expect(assessment.match_confidence).toBe("medium");
    expect(assessment.reasons).toContain("doi_match");
    expect(assessment.missing).toEqual(
      expect.arrayContaining(["title_match", "year_match", "author_overlap"])
    );
  });

  it("uses title, year, and author overlap for title-only records", () => {
    const assessment = assessMatchConfidence(
      {
        doi: null,
        title: "明治期俳句雑誌の研究",
        authors: ["正岡子規", "高浜虚子"],
        issued_year: "1998"
      },
      {
        doi: null,
        title: "明治期俳句雑誌研究",
        authors: ["正岡子規"],
        issued_year: "1998"
      }
    );

    expect(assessment.match_confidence).toBe("high");
    expect(assessment.reasons).toEqual(
      expect.arrayContaining(["title_match", "year_match", "author_overlap"])
    );
  });

  it("does not over-confirm unrelated title-only records", () => {
    const assessment = assessMatchConfidence(
      {
        doi: null,
        title: "近世俳諧資料目録",
        authors: ["山田太郎"],
        issued_year: "2001"
      },
      {
        doi: null,
        title: "源氏物語享受史",
        authors: ["山田太郎"],
        issued_year: "2001"
      }
    );

    expect(assessment.match_confidence).toBe("low");
    expect(assessment.missing).toContain("title_match");
  });
});
