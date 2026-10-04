import { regionSchema } from "./schemas.js";
import type { RegionEvidence } from "./types.js";
export function toWebAnnotations(items: RegionEvidence[]) {
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    type: "AnnotationPage",
    profile: "jp-lit-rectangle-0.1",
    items: items.map((r) => ({
      id: `urn:uuid:${r.selection.region_id}`,
      type: "Annotation",
      motivation: "commenting",
      target: {
        type: "SpecificResource",
        source: r.selection.canvas_id,
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: `xywh=${r.selection.xywh.join(",")}`,
        },
      },
      body: [
        { type: "TextualBody", value: r.note, purpose: "commenting" },
        ...r.tags.map((value) => ({
          type: "TextualBody",
          value,
          purpose: "tagging",
        })),
      ],
      jp_lit: r,
    })),
  };
}
export function fromWebAnnotations(value: unknown): RegionEvidence[] {
  const p = value as ReturnType<typeof toWebAnnotations>;
  if (
    p?.type !== "AnnotationPage" ||
    p.profile !== "jp-lit-rectangle-0.1" ||
    !Array.isArray(p.items) ||
    p.items.length > 1000
  )
    throw new Error("jp-litの矩形AnnotationPageを指定してください");
  return p.items.map((a) => {
    const r = regionSchema.parse(a.jp_lit);
    if (
      a.type !== "Annotation" ||
      a.target?.selector?.type !== "FragmentSelector" ||
      a.target.source !== r.selection.canvas_id ||
      a.target.selector.value !== `xywh=${r.selection.xywh.join(",")}`
    )
      throw new Error("矩形selectorと領域の記録が一致しません");
    return r;
  });
}
