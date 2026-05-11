import { InvalidRequestError } from "./errors.js";
import type { SourceName } from "./types.js";

const NDL_SOURCE_ID_PATTERN = /^R[0-9A-Za-z-]+$/;
const NDL_ARTICLE_SOURCE_ID_PATTERN = /^(?:R[0-9A-Za-z-]+|crid:\d{10,})$/;
const CINII_SOURCE_ID_PATTERN = /^\d{10,}$/;
const IRDB_SOURCE_ID_PATTERN = /^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)+$/;
const JDCAT_SOURCE_ID_PATTERN = /^\d+$/;
const JSTAGE_SOURCE_ID_PATTERN = /^\/article\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+)*\/?$/;
const NATIONAL_ARCHIVES_SOURCE_ID_PATTERN = /^\d+$/;
const JACAR_SOURCE_ID_PATTERN = /^[A-Z]\d{10,}$/;
const NIJL_ARTICLES_SOURCE_ID_PATTERN = /^\d{8}$/;
const GENERIC_SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const NDL_PID_PATTERN = /^\d+$/;

function assertSourceId(source: SourceName, sourceId: string, pattern: RegExp, hint: string) {
  if (!pattern.test(sourceId)) {
    throw new InvalidRequestError(
      `${source} の source_id 形式が不正です: ${sourceId}（例: ${hint}）`
    );
  }
}

export function validateSourceId(source: SourceName, sourceId: string): string {
  const trimmed = sourceId.trim();
  if (!trimmed) {
    throw new InvalidRequestError("source_id は空にできません");
  }

  switch (source) {
    case "ndl_search":
    case "ndl_catalog":
    case "ndl_digital":
    case "ndl_articles_online":
      assertSourceId(source, trimmed, NDL_SOURCE_ID_PATTERN, "R100000039-I1000732");
      break;
    case "ndl_articles":
      assertSourceId(
        source,
        trimmed,
        NDL_ARTICLE_SOURCE_ID_PATTERN,
        "R000000004-I6744322 または crid:1520572357331530496"
      );
      break;
    case "cinii_articles":
    case "cinii_books":
      assertSourceId(source, trimmed, CINII_SOURCE_ID_PATTERN, "1573387450265380480");
      break;
    case "irdb":
      assertSourceId(source, trimmed, IRDB_SOURCE_ID_PATTERN, "/01242/0007332690");
      break;
    case "jdcat":
      assertSourceId(source, trimmed, JDCAT_SOURCE_ID_PATTERN, "43494");
      break;
    case "jstage_articles":
      assertSourceId(source, trimmed, JSTAGE_SOURCE_ID_PATTERN, "/article/example/_article/-char/ja/");
      break;
    case "national_archives":
      assertSourceId(source, trimmed, NATIONAL_ARCHIVES_SOURCE_ID_PATTERN, "3148544");
      break;
    case "jacar":
      assertSourceId(source, trimmed, JACAR_SOURCE_ID_PATTERN, "A01000012800");
      break;
    case "nijl_articles":
      assertSourceId(source, trimmed, NIJL_ARTICLES_SOURCE_ID_PATTERN, "00000002");
      break;
    case "japan_search":
    case "kokkai_minutes":
    case "teikoku_minutes":
    case "nihu_bridge":
    case "kokusho":
    case "ninjal_bibliography":
      assertSourceId(source, trimmed, GENERIC_SAFE_ID_PATTERN, "英数字・._:- のみ");
      break;
    default: {
      const exhaustiveCheck: never = source;
      return exhaustiveCheck;
    }
  }

  return trimmed;
}

export function validateNdlPid(pid: string): string {
  const trimmed = pid.trim();
  if (!NDL_PID_PATTERN.test(trimmed)) {
    throw new InvalidRequestError("pid 形式が不正です: 数字のみを指定してください");
  }

  return trimmed;
}
