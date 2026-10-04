import { createHash } from "node:crypto";
import { asList, asObject, resourceId } from "./manifest.js";
import { loadPublicResource } from "./publicResource.js";
import { textSchema } from "./schemas.js";
import type { ManifestDocument, TextEvidence } from "./types.js";
function textTarget(
  value: unknown,
  canvasId: string,
): number[] | null | undefined {
  const target =
    typeof value === "string" ? value : resourceId(asObject(value).source);
  const [source, fragment] = target.split("#");
  if (source !== canvasId) return undefined;
  const object = asObject(value);
  const selector = object.selector;
  if (
    selector != null &&
    (object.type !== "SpecificResource" ||
      selector.type !== "FragmentSelector" ||
      fragment !== undefined)
  )
    return undefined;
  const part = selector == null ? fragment : selector.value;
  if (part === undefined && selector == null) return null;
  if (typeof part !== "string") return undefined;
  const match = part.match(
    /^xywh=(?:pixel:)?(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/,
  );
  if (!match) return undefined;
  const rect = match.slice(1).map(Number);
  return rect.every(Number.isFinite) && rect[2] > 0 && rect[3] > 0
    ? rect
    : undefined;
}
export function collectText(
  page: unknown,
  canvasId: string,
  hash: string,
  diagnostics: string[] = [],
): TextEvidence[] {
  const result: TextEvidence[] = [];
  for (const a of asList(asObject(page).items)) {
    const rectangle = textTarget(a.target, canvasId);
    if (rectangle === undefined) {
      diagnostics.push(`text targetを保留: ${JSON.stringify(a.target)}`);
      continue;
    }
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
              .update(
                ref +
                  "\n" +
                  canvasId +
                  "\n" +
                  JSON.stringify(rectangle) +
                  "\n" +
                  b.value,
              )
              .digest("hex")
              .slice(0, 16)}`,
            canvas_id: canvasId,
            target_xywh: rectangle,
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
  diagnostics: string[] = [],
): Promise<TextEvidence[]> {
  const c = document.canvases.find((c) => c.canvas_id === canvasId);
  if (!c) throw new Error("Canvasが見つかりません");
  const result: TextEvidence[] = [];
  let external = false;
  for (const ref of c.text_refs) {
    const p = asObject(ref);
    if (p.items)
      result.push(
        ...collectText(p, canvasId, document.receipt.sha256, diagnostics),
      );
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
          diagnostics,
        ),
      );
    }
  }
  return [...new Map(result.map((t) => [t.text_id, t])).values()];
}
