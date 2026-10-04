import type { RecordItem } from "../lib/types.js";
import type { ManifestCandidate } from "./types.js";
export function extractManifestCandidates(
  records: RecordItem[],
): ManifestCandidate[] {
  const result: ManifestCandidate[] = [];
  for (const r of records) {
    let manifest =
      r.source === "kokusho"
        ? r.source_metadata.manifest_url
        : r.source === "japan_search"
          ? r.source_metadata.iiif_url
          : null;
    let acquisition: ManifestCandidate["acquisition"] = "provider_metadata";
    if (!manifest && r.source.startsWith("ndl_")) {
      const pid = String(r.identifiers.ndljp ?? "").replace(
        /^info:ndljp\/pid\//,
        "",
      );
      if (/^\d+$/.test(pid)) {
        manifest = `https://dl.ndl.go.jp/api/iiif/${pid}/manifest.json`;
        acquisition = "derived_from_pid";
      }
    }
    if (typeof manifest === "string" && /^https:\/\//.test(manifest))
      result.push({
        source: r.source,
        source_id: r.source_id,
        record_url: r.url,
        manifest_url: manifest,
        acquisition,
        verification_state: "candidate",
      });
  }
  return result;
}
