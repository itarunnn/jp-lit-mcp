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

export function mapKokushoImageTagsResponse(payload: unknown, limit: number) {
  const response = payload as Record<string, unknown> | null;
  const data = response && Array.isArray(response.data) ? response.data : null;
  if (!data) {
    return null;
  }

  const total = readNumber(response?.total) ?? data.length;
  const upstreamPage = readNumber(response?.current_page);
  const upstreamLastPage = readNumber(response?.last_page);
  const upstreamPerPage = readNumber(response?.per_page);
  const selected = data
    .filter((item) => {
      const record = item as Record<string, unknown>;
      const tags = Array.isArray(record.tag) ? record.tag : [];
      return (
        readString(record.bid) !== null &&
        tags.some((tag) => readString((tag as Record<string, unknown>).text) !== null)
      );
    })
    .slice(0, limit);
  const items = selected.map((item) => {
    const record = item as Record<string, unknown>;
    const bid = readString(record.bid) ?? "missing-kokusho-id";
    const koma = readNumber(record.koma);
    const tags = Array.isArray(record.tag) ? record.tag : [];
    const tagRecords = tags.map((tag) => tag as Record<string, unknown>);

    return {
      bid,
      source_id: bid,
      title: readString(record.name),
      work_title: readString(record.wname),
      authors: readStringArray(record.authorlist).map((name) => ({ name, role: "author" })),
      koma,
      tag_texts: tagRecords
        .map((tag) => readString(tag.text))
        .filter((entry): entry is string => entry !== null),
      image_paths: tagRecords
        .map((tag) => readString(tag.imagepath))
        .filter((entry): entry is string => entry !== null),
      viewer_url: buildViewerUrl(bid, koma),
      biblio_url: buildBiblioUrl(bid),
      source_metadata: {
        collection: record.collection ?? null,
        seikyu: record.seikyu ?? null,
        kansha: record.kansha ?? null,
        year: record.year ?? null,
        keitai: record.keitai ?? null,
        satsu: record.satsu ?? null,
        zan: record.zan ?? null,
        shubetsu: record.shubetsu ?? null,
        wkeyword: record.wkeyword ?? null,
        authorhead: record.authorhead ?? null,
        upstream_per_page: upstreamPerPage,
        upstream_last_page: upstreamLastPage
      }
    };
  });

  return {
    total,
    items,
    raw: {
      endpoint: "tagSearch",
      upstream_total: total,
      upstream_page: upstreamPage,
      upstream_last_page: upstreamLastPage,
      returned_count: items.length
    }
  };
}
