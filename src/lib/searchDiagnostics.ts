import type {
  SearchBreadth,
  SearchDiagnostic,
  SearchInterpretation,
  SourceName
} from "./types.js";

function detectScript(value: string) {
  let hasLatinLetter = false;
  let hasKana = false;
  let hasHan = false;

  for (const char of value) {
    if (/[a-z]/i.test(char)) {
      hasLatinLetter = true;
    }
    if (/[\u3040-\u30ff\uff66-\uff9d]/u.test(char)) {
      hasKana = true;
    }
    if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(char)) {
      hasHan = true;
    }
  }

  if (hasLatinLetter && !hasKana && !hasHan) {
    return "latin";
  }
  if (hasLatinLetter && (hasKana || hasHan)) {
    return "mixed";
  }
  if (hasHan && hasKana) {
    return "han_kana";
  }
  if (hasHan) {
    return "han";
  }
  if (hasKana) {
    return "kana";
  }

  return "other";
}

export function classifySearchBreadth(total: number): SearchBreadth {
  if (total <= 0) {
    return "none";
  }
  if (total <= 50) {
    return "narrow";
  }
  if (total <= 1000) {
    return "broad";
  }

  return "very_broad";
}

function matchingModeForSource(source: SourceName | null): SearchInterpretation["matching_mode"] {
  if (!source) {
    return "aggregated_cross_source";
  }
  if (
    source === "cinii_articles" ||
    source === "cinii_books" ||
    source === "cinii_dissertations"
  ) {
    return "metadata_conjunction";
  }

  return "unknown";
}

export function buildSearchInterpretation(input: {
  source: SourceName | null;
  total: number;
}): SearchInterpretation {
  return {
    matching_mode: matchingModeForSource(input.source),
    breadth: classifySearchBreadth(input.total)
  };
}

export function buildSearchDiagnostics(input: {
  query: string;
  source: SourceName | null;
  total: number;
}): SearchDiagnostic[] {
  const diagnostics: SearchDiagnostic[] = [];
  const isCinii =
    input.source === "cinii_articles" ||
    input.source === "cinii_books" ||
    input.source === "cinii_dissertations";

  if (isCinii && input.total === 0 && /\s/.test(input.query.trim())) {
    diagnostics.push({
      level: "warning",
      code: "ZERO_METADATA_CONJUNCTION",
      message:
        "CiNii は主にメタデータを AND 条件で照合するため、複合語や語を詰めた検索で 0 件になることがあります。",
      hint:
        "検索語を 1 語にする、漢字・かな表記を変える、source を cinii_books / cinii_articles で切り替える、または NDL / J-STAGE / IRDB も確認してください。"
    });
  }

  if (isCinii && detectScript(input.query) === "latin") {
    diagnostics.push({
      level: "warning",
      code: "SCRIPT_LATIN_QUERY",
      message:
        "ローマ字・英字だけの query は、日本語本文・日本語メタデータの主な表記を拾わないことがあります。",
      hint: "漢字・かな表記、著者名の日本語表記、件名語を使って再検索してください。"
    });
  }

  if (input.total > 1000) {
    diagnostics.push({
      level: "warning",
      code: "VERY_BROAD_RESULT_SET",
      message: "検索結果が非常に広く、候補選別には追加の絞り込みが必要です。",
      hint: "刊行年、source 固有 filter、著者名、分類記号、件名語を追加して絞り込んでください。"
    });
  } else if (input.total > 50) {
    diagnostics.push({
      level: "info",
      code: "BROAD_RESULT_SET",
      message: "検索結果が広めです。",
      hint: "候補を比較する前に、年代・資料種別・著者・source を分けて確認すると安定します。"
    });
  }

  return diagnostics;
}
