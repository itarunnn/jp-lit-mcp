import {
  assessMatchConfidence,
  ENRICH_RECORD_CAUTION,
  normalizeDoi
} from "./matching.js";
import type {
  EnrichRecordOutput,
  EnrichRecordOutputQuery,
  EnrichRecordQuery,
  ExternalProvider,
  ExternalWorkClient,
  ExternalWorkMatch
} from "./types.js";

interface ExternalWorkEnricherOptions {
  crossrefClient: ExternalWorkClient;
  openalexClient: ExternalWorkClient;
}

const CONFIDENCE_WEIGHT: Record<ExternalWorkMatch["match_confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0
};

function normalizeQuery(input: EnrichRecordQuery): EnrichRecordQuery {
  return {
    doi: normalizeDoi(input.doi),
    title: input.title?.trim() || null,
    authors: input.authors.map((author) => author.trim()).filter(Boolean),
    issued_year: input.issued_year?.trim() || null,
    providers: input.providers
  };
}

function toOutputQuery(input: EnrichRecordQuery): EnrichRecordOutputQuery {
  return {
    doi: input.doi,
    title: input.title,
    authors: input.authors,
    issued_year: input.issued_year
  };
}

function providerOrder(provider: ExternalProvider) {
  return provider === "crossref" ? 0 : 1;
}

export function createExternalWorkEnricher(options: ExternalWorkEnricherOptions) {
  const clients: Record<ExternalProvider, ExternalWorkClient> = {
    crossref: options.crossrefClient,
    openalex: options.openalexClient
  };

  return {
    async enrich(input: EnrichRecordQuery): Promise<EnrichRecordOutput> {
      const query = normalizeQuery(input);
      const outputQuery = toOutputQuery(query);
      const providers: EnrichRecordOutput["providers"] = {};
      const matches: ExternalWorkMatch[] = [];

      for (const provider of query.providers) {
        const result = await clients[provider].lookup(query);
        providers[provider] = {
          status: result.status,
          item_count: result.item_count,
          note: result.note
        };

        for (const item of result.items) {
          matches.push({
            ...item,
            ...assessMatchConfidence(item, outputQuery)
          });
        }
      }

      matches.sort((left, right) => {
        const confidenceDelta =
          CONFIDENCE_WEIGHT[right.match_confidence] - CONFIDENCE_WEIGHT[left.match_confidence];
        if (confidenceDelta !== 0) return confidenceDelta;
        const providerDelta = providerOrder(left.provider) - providerOrder(right.provider);
        if (providerDelta !== 0) return providerDelta;
        return (right.cited_by_count ?? -1) - (left.cited_by_count ?? -1);
      });

      return {
        query: outputQuery,
        providers,
        matches,
        caution: ENRICH_RECORD_CAUTION
      };
    }
  };
}

export type ExternalWorkEnricher = ReturnType<typeof createExternalWorkEnricher>;
