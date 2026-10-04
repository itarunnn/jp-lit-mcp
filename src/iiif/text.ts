import { createHash } from "node:crypto";
import { asList, asObject, resourceId } from "./manifest.js";
import { loadPublicResource } from "./publicResource.js";
import { textSchema } from "./schemas.js";
import type { ManifestDocument, TextEvidence } from "./types.js";
export function collectText(
  page: unknown,
  canvasId: string,
  hash: string,
): TextEvidence[] {
  const result: TextEvidence[] = [];
  for (const a of asList(asObject(page).items)) {
    const target =
      typeof a.target === "string" ? a.target : resourceId(a.target?.source);
    if (target.split("#")[0] !== canvasId) continue;
    const fragment = target.match(
      /#xywh=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/,
    );
    for (const b of asList(a.body))
      if (
        b?.type === "TextualBody" &&
        typeof b.value === "string" &&
        (!b.format || b.format === "text/plain")
      ) {
        const ref =
          resourceId(a) || resourceId(page) || `${canvasId}#inline-text`;
        result.push(
          textSchema.parse({
            text_id: `text-${createHash("sha256")
              .update(ref + "\n" + b.value)
              .digest("hex")
              .slice(0, 16)}`,
            canvas_id: canvasId,
            target_xywh: fragment ? fragment.slice(1).map(Number) : null,
            source_ref: ref,
            source_sha256: hash,
            text: b.value,
            origin: "provider_annotation",
            verification_state: "provider_text",
          }),
        );
      }
  }
  return result;
}
export async function loadSelectedText(
  document: ManifestDocument,
  canvasId: string,
): Promise<TextEvidence[]> {
  const c = document.canvases.find((c) => c.canvas_id === canvasId);
  if (!c) throw new Error("Canvasが見つかりません");
  const result: TextEvidence[] = [];
  let external = false;
  for (const ref of c.text_refs) {
    const p = asObject(ref);
    if (p.items)
      result.push(...collectText(p, canvasId, document.receipt.sha256));
    else if (!external && resourceId(p)) {
      external = true;
      const r = await loadPublicResource(resourceId(p), {
        max_bytes: 2 * 1024 * 1024,
        timeout_ms: 15000,
        max_redirects: 3,
        kind: "json",
      });
      result.push(
        ...collectText(
          JSON.parse(Buffer.from(r.body).toString("utf8")),
          canvasId,
          r.receipt.sha256,
        ),
      );
    }
  }
  return [...new Map(result.map((t) => [t.text_id, t])).values()];
}
