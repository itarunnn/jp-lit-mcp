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
  predicateContracts: Array<{
    positive: RegExp;
    negatives: RegExp[];
  }>;
};

const relationContracts: RelationContract[] = [
  {
    relation: "mcp_performs_browser_operations",
    subjectGroups: [[/mcp(?:本体)?/i], [/(?:ブラウザ|browser)(?:操作)?/i]],
    predicateContracts: [
      {
        positive: /行う/,
        negatives: [/行う(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /実行する/,
        negatives: [/実行する(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /担当する/,
        negatives: [/担当する(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /操作する/,
        negatives: [/操作する(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /起動する/,
        negatives: [/起動する(?:こと(?:は|も)ない|わけではない|ものではない)/]
      }
    ]
  },
  {
    relation: "search_hit_means_body_confirmed",
    subjectGroups: [
      [/検索ヒット/],
      [/本文(?:を)?確認(?:済み|した)|本文確認を完了/]
    ],
    predicateContracts: [
      {
        positive: /扱う/,
        negatives: [/扱う(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /みなす/,
        negatives: [/みなす(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /意味する/,
        negatives: [/意味する(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      { positive: /同じ状態/, negatives: [/同じ(?:状態)?ではない/] },
      { positive: /同一視/, negatives: [/同一視しない/] },
      {
        positive: /(?:なら|であれば|=)/,
        negatives: [/本文(?:を)?確認(?:済み|した)?ではない|とはしない|にはしない/]
      }
    ]
  },
  {
    relation: "dialog_means_pdf_saved",
    subjectGroups: [
      [/dialog_available/i],
      [/(?:pdf)?保存済み|pdf(?:を)?保存した(?:こと)?/i]
    ],
    predicateContracts: [
      {
        positive: /扱う/,
        negatives: [/扱う(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /みなす/,
        negatives: [/みなす(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /意味する/,
        negatives: [/意味する(?:こと(?:は|も)ない|わけではない|ものではない)/]
      },
      {
        positive: /(?:なら|であれば|=)/,
        negatives: [/(?:pdf)?保存済みではない|pdf(?:を)?保存したことにはしない/i]
      }
    ]
  },
  {
    relation: "onsite_login_allows_remote_access",
    subjectGroups: [[/ndl_onsite_only/i], [/ログイン/], [/(?:遠隔|リモート)/]],
    predicateContracts: [
      {
        positive: /可能/,
        negatives: [/(?:不可能|可能ではない|可能でない)/]
      },
      {
        positive: /できる/,
        negatives: [/できる(?:わけではない|ものではない)/]
      },
      {
        positive: /(?:遠隔|リモート(?:で)?)(?:閲覧)?可(?:$|[、。]|です|である|となる|とする)/,
        negatives: [/(?:遠隔|リモート(?:で)?)(?:閲覧)?(?:不可|可ではない)/]
      }
    ]
  }
];

function normalizeStatement(statement: string) {
  return statement
    .normalize("NFKC")
    .replace(/[`*~]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function splitContractClauses(markdown: string) {
  return markdown
    .split(
      /(?<=[。！？.!?])|\r?\n+|が[、,]|けれど(?:も)?[、,]?|[、,]?(?:ただし|しかし|一方(?:で)?)[、,]?|[、,](?=\s*(?:mcp(?:\s*本体)?|browser\s+agent|ブラウザ(?:\s*agent)?|エージェント)\s*(?:は|が))/i
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/**
 * 日本語全般を意味判定するものではなく、公開文書で禁止する4関係だけを
 * 主体・対象・述語の有限パターンで検査するlint。
 */
export function lintForbiddenBrowserContractClaims(
  markdown: string
): BrowserContractViolation[] {
  return splitContractClauses(markdown).flatMap((excerpt) => {
    const normalized = normalizeStatement(excerpt);
    return relationContracts.flatMap(
      ({ relation, subjectGroups, predicateContracts }) => {
        const hasSubjects = subjectGroups.every((alternatives) =>
          alternatives.some((pattern) => pattern.test(normalized))
        );
        const hasPositivePredicate = predicateContracts.some(
          ({ positive, negatives }) =>
            positive.test(normalized) &&
            negatives.every((negative) => !negative.test(normalized))
        );

        return hasSubjects && hasPositivePredicate
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
