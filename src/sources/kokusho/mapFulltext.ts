const BASE_URL = "https://kokusho.nijl.ac.jp";

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => readString(entry))
        .filter((entry): entry is string => entry !== null)
    : [];
}

function buildBiblioUrl(bid: string) {
  return `${BASE_URL}/biblio/${encodeURIComponent(bid)}`;
}

function buildViewerUrl(bid: string, koma: number | null) {
  const biblioUrl = buildBiblioUrl(bid);
  return koma ? `${biblioUrl}/${koma}` : biblioUrl;
}

function snippetText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapKokushoFulltextResponse(payload: unknown, page: number, limit: number) {
  if (!Array.isArray(payload)) {
    return null;
  }

  const offset = (page - 1) * limit;
  const selected = payload.slice(offset, offset + limit);
  const items = selected.map((item) => {
    const record = item as Record<string, unknown>;
    const bid = readString(record.bid) ?? "missing-kokusho-id";
    const koma = readNumber(record.koma);
    const line = readNumber(record.line);
    const context = readString(record.context);

    return {
      bid,
      source_id: bid,
      title: readString(record.title),
      work_title: readString(record.wname),
      authors: readStringArray(record.authorlist).map((name) => ({ name, role: "author" })),
      koma,
      line,
      snippet: context ? snippetText(context) : null,
      viewer_url: buildViewerUrl(bid, koma),
      biblio_url: buildBiblioUrl(bid),
      source_metadata: {
        satsu: record.satsu ?? null,
        line,
        totalkoma: record.totalkoma ?? null,
        kansha: record.kansha ?? null,
        shubetsu: record.shubetsu ?? null,
        wkeyword: record.wkeyword ?? null,
        authorhead: record.authorhead ?? null
      }
    };
  });

  return {
    total: payload.length,
    items,
    raw: {
      endpoint: "fulltextSearch",
      upstream_total: payload.length,
      returned_count: items.length
    }
  };
}
