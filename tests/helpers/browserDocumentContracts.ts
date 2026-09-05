export type JsonToolCall = {
  tool: string;
  arguments: unknown;
};

export type BrowserContractViolation = {
  relation:
    | "mcp_performs_browser_operations"
    | "search_hit_means_body_confirmed"
    | "dialog_means_pdf_saved"
    | "onsite_login_allows_remote_access";
  excerpt: string;
};

type RelationContract = {
  relation: BrowserContractViolation["relation"];
  subjectGroups: RegExp[][];
  positiveClaims: RegExp[];
  negativeClaims: RegExp[];
};

const relationContracts: RelationContract[] = [
  {
    relation: "mcp_performs_browser_operations",
    subjectGroups: [[/mcp本体/i], [/(?:ブラウザ|browser)/i]],
    positiveClaims: [/(?:行う|実行する|担当する|操作する|起動する)/],
    negativeClaims: [
      /(?:行わない|行わず|実行しない|実行せず|担当しない|担当せず|操作しない|操作せず|起動しない|起動せず)/,
      /(?:行う|実行する|担当する|操作する|起動する)こと(?:は|も)ない/
    ]
  },
  {
    relation: "search_hit_means_body_confirmed",
    subjectGroups: [[/検索ヒット/], [/本文(?:を)?確認済み|本文確認を完了/]],
    positiveClaims: [/(?:扱う|みなす|意味する|同じ状態|同一視|なら|であれば|=)/],
    negativeClaims: [
      /(?:扱わない|みなさない|意味しない|同じではない|同一視しない|とはしない|にはしない)/,
      /(?:扱う|みなす|意味する)こと(?:は|も)ない/
    ]
  },
  {
    relation: "dialog_means_pdf_saved",
    subjectGroups: [[/dialog_available/i], [/(?:pdf)?保存済み/i]],
    positiveClaims: [/(?:扱う|みなす|意味する|なら|であれば|=)/],
    negativeClaims: [
      /(?:扱わない|みなさない|意味しない|ではない|とはしない|にはしない)/,
      /(?:扱う|みなす|意味する)こと(?:は|も)ない/
    ]
  },
  {
    relation: "onsite_login_allows_remote_access",
    subjectGroups: [[/ndl_onsite_only/i], [/ログイン/], [/遠隔/]],
    positiveClaims: [/(?:可能|できる)/, /遠隔(?:閲覧)?可(?:$|[、。]|です|である|となる|とする)/],
    negativeClaims: [/(?:できない|不可|不可能|可能ではない|可能でない|認めない)/]
  }
];

function normalizeStatement(statement: string) {
  return statement
    .normalize("NFKC")
    .replace(/[`*~]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function splitStatements(markdown: string) {
  return markdown
    .split(/(?<=[。！？.!?])|\r?\n+/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function findForbiddenBrowserClaims(markdown: string): BrowserContractViolation[] {
  return splitStatements(markdown).flatMap((excerpt) => {
    const normalized = normalizeStatement(excerpt);
    return relationContracts.flatMap(
      ({ relation, subjectGroups, positiveClaims, negativeClaims }) => {
        const hasSubjects = subjectGroups.every((alternatives) =>
          alternatives.some((pattern) => pattern.test(normalized))
        );
        const isPositiveClaim = positiveClaims.some((pattern) => pattern.test(normalized));
        const isExplicitlyNegative = negativeClaims.some((pattern) => pattern.test(normalized));

        return hasSubjects && isPositiveClaim && !isExplicitlyNegative
          ? [{ relation, excerpt }]
          : [];
      }
    );
  });
}

export function extractJsonToolCall(markdown: string, tool: string): JsonToolCall {
  const parsedBlocks = [...markdown.matchAll(/```json[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```/g)].map(
    (match, index): unknown => {
      try {
        return JSON.parse(match[1]);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON fence ${index + 1}: ${detail}`);
      }
    }
  );

  const block = parsedBlocks.find(
    (candidate): candidate is JsonToolCall =>
      typeof candidate === "object" &&
      candidate !== null &&
      "tool" in candidate &&
      candidate.tool === tool &&
      "arguments" in candidate
  );

  if (!block) {
    throw new Error(`JSON example not found for ${tool}`);
  }

  return block;
}
