import { createHash } from "node:crypto";
import { documentSchema } from "./schemas.js";
import type {
  LanguageText,
  ManifestDocument,
  ResourceReceipt,
} from "./types.js";
export function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
export function asList(value: unknown): any[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
export function resourceId(value: any): string {
  return typeof value === "string"
    ? value
    : String(value?.id ?? value?.["@id"] ?? "");
}
export function languageText(value: unknown): LanguageText {
  if (typeof value === "string") return [{ language: null, values: [value] }];
  if (Array.isArray(value)) return value.flatMap(languageText);
  const v = asObject(value);
  if (typeof v["@value"] === "string")
    return [{ language: v["@language"] ?? null, values: [v["@value"]] }];
  return Object.entries(v)
    .filter(([, vals]) => asList(vals).every((x) => typeof x === "string"))
    .map(([language, vals]) => ({
      language: language === "none" ? null : language,
      values: asList(vals),
    }));
}
export function scopedRights(value: any, scope: string) {
  return [
    "license",
    "attribution",
    "rights",
    "requiredStatement",
    "provider",
    "metadata",
  ]
    .filter((k) => value[k] != null)
    .map((field) => ({ scope, field, value: value[field] }));
}
function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
function imageService(value: any) {
  const s = asList(value).find((s) =>
    /ImageService[123]|\/api\/image\//.test(JSON.stringify(s)),
  );
  if (!s || !resourceId(s)) return null;
  const signature = JSON.stringify(s);
  const version = /ImageService3|\/image\/3\//.test(signature)
    ? "3"
    : /ImageService2|\/image\/2\//.test(signature)
      ? "2"
      : /ImageService1|\/image\/1\//.test(signature)
        ? "1"
        : null;
  return version
    ? { service_id: resourceId(s), version, profile: s.profile ?? null }
    : null;
}
export function normalizeManifest(
  input: unknown,
  receipt: ResourceReceipt,
  sequenceId?: string,
): ManifestDocument {
  const m = asObject(input);
  const type = m.type ?? m["@type"];
  const v = type === "Manifest" ? "3" : type === "sc:Manifest" ? "2" : null;
  if (!v) throw new Error("静止画像のIIIF Manifestを指定してください");
  const declared = resourceId(m);
  if (!declared) throw new Error("manifest IDがありません");
  const sequences =
    v === "2"
      ? asList(m.sequences)
      : [{ id: declared, label: m.label, canvases: m.items }];
  if (!sequences.length) throw new Error("sequenceがありません");
  const summaries = sequences.map((s, i) => ({
    sequence_id: resourceId(s) || `${declared}#sequence-${i + 1}`,
    label: languageText(s.label),
  }));
  const index = sequenceId
    ? summaries.findIndex((s) => s.sequence_id === sequenceId)
    : 0;
  if (index < 0) throw new Error("指定sequenceが見つかりません");
  const rawCanvases = asList(sequences[index].canvases);
  if (rawCanvases.length > 2000) throw new Error("Canvas上限2000を超えます");
  const canvases = rawCanvases.map((raw, i) => {
    const c = asObject(raw);
    const canvasId = resourceId(c);
    const paintings =
      v === "2"
        ? asList(c.images)
        : asList(c.items)
            .flatMap((p) => asList(p.items))
            .filter((a) => asList(a.motivation).includes("painting"));
    const images = paintings.flatMap((a) =>
      asList(v === "2" ? a.resource : a.body)
        .filter(
          (b) =>
            ["Image", "dctypes:Image"].includes(b?.type ?? b?.["@type"]) ||
            String(b?.format ?? "").startsWith("image/"),
        )
        .map((b) => ({
          image_id: resourceId(b),
          width: positive(b.width),
          height: positive(b.height),
          target: v === "2" ? a.on : a.target,
          rights: scopedRights(b, `image:${resourceId(b)}`),
          service: imageService(b.service),
        })),
    );
    return {
      canvas_id: canvasId,
      label: languageText(c.label),
      canvas_index_1based: i + 1,
      width: c.width,
      height: c.height,
      images,
      text_refs: v === "3" ? asList(c.annotations) : [],
      rights: scopedRights(c, `canvas:${canvasId}`),
    };
  });
  const result = documentSchema.parse({
    document_id: `doc-${createHash("sha256")
      .update(receipt.requested_url + "\n" + summaries[index].sequence_id)
      .digest("hex")
      .slice(0, 16)}`,
    candidate: {
      source: "manual",
      source_id: declared,
      record_url: null,
      manifest_url: receipt.requested_url,
      acquisition: "manual_url",
      verification_state: "candidate",
    },
    receipt,
    declared_id: declared,
    presentation_version: v,
    label: languageText(m.label),
    sequences: summaries,
    selected_sequence_id: summaries[index].sequence_id,
    canvases,
    rights: [
      ...scopedRights(m, "manifest"),
      ...scopedRights(
        sequences[index],
        `sequence:${summaries[index].sequence_id}`,
      ),
    ],
    diagnostics: [],
  });
  if (new Set(canvases.map((c) => c.canvas_id)).size !== canvases.length)
    throw new Error("Canvas IDが重複しています");
  if (
    !result.rights.some((r) =>
      ["license", "rights"].includes(asObject(r).field),
    )
  )
    result.diagnostics.push("利用条件の明記を確認してください");
  if (canvases.some((c) => c.images.length !== 1))
    result.diagnostics.push("単一画像以外のCanvasはcrop取得を保留します");
  return result;
}
