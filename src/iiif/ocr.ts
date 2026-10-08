import { z } from "zod";
import { ocrLineSchema, ocrSourceSchema, type OcrLine, type OcrSource } from "./ocrSchemas.js";
const rawOutputSchema = z.object({
  imginfo: z.object({ img_width: z.number().int().positive(), img_height: z.number().int().positive() }),
  contents: z.array(z.array(z.object({
    id: z.union([z.string().min(1), z.number().int().nonnegative()]), text: z.string().max(2 * 1024 * 1024),
    boundingBox: z.array(z.tuple([z.number().finite(), z.number().finite()])).length(4),
    confidence: z.number().finite().min(0).max(1).optional(),
  })).max(10000)).length(1),
});

export function validateOcrSource(input: unknown): OcrSource {
  const s = ocrSourceSchema.parse(input), [x,y,w,h] = s.selection.xywh;
  if (s.evidence_id !== s.selection.region_id || x+w > s.canvas_width || y+h > s.canvas_height)
    throw new Error("OCR出典の領域が不正です");
  const [ix,iy,iw,ih] = s.original_image_xywh, { scale_x: sx, scale_y: sy } = s.canvas_to_image;
  const close = (a: number, b: number) => Math.abs(a-b) < 1e-7;
  if (!close(s.image_width / iw, s.scale_x) || !close(s.image_height / ih, s.scale_y) ||
      Math.abs(ix - x*sx) > 1.0000001 || Math.abs(iy - y*sy) > 1.0000001 ||
      Math.abs(ix+iw - (x+w)*sx) > 1.0000001 || Math.abs(iy+ih - (y+h)*sy) > 1.0000001)
    throw new Error("OCR画像の縮小率・cropとCanvas領域が一致しません");
  return s;
}

export function normalizeKotenOutput(input: unknown, source: OcrSource): OcrLine[] {
  const s = validateOcrSource(source), raw = rawOutputSchema.parse(input);
  if (raw.imginfo.img_width !== s.image_width || raw.imginfo.img_height !== s.image_height)
    throw new Error("OCR出力の画像寸法が一致しません");
  const ids = new Set<string>();
  return raw.contents[0].map((line) => {
    const id = String(line.id);
    if (ids.has(id)) throw new Error("OCR行IDの重複があります");
    ids.add(id);
    const xs = line.boundingBox.map((p) => p[0]), ys = line.boundingBox.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys), right = Math.max(...xs), bottom = Math.max(...ys);
    if (x < 0 || y < 0 || right > s.image_width || bottom > s.image_height || right <= x || bottom <= y)
      throw new Error("OCR行領域が画像の外にあります");
    const [ix,iy] = s.original_image_xywh, { scale_x: sx, scale_y: sy } = s.canvas_to_image;
    const cx = (ix+x/s.scale_x)/sx, cy = (iy+y/s.scale_y)/sy;
    const cr = (ix+right/s.scale_x)/sx, cb = (iy+bottom/s.scale_y)/sy;
    if (cx < -1e-7 || cy < -1e-7 || cr > s.canvas_width+1e-7 || cb > s.canvas_height+1e-7)
      throw new Error("OCR行領域がCanvasの外にあります");
    const left = Math.max(0,cx), top = Math.max(0,cy);
    return ocrLineSchema.parse({ line_id: id, text: line.text, bounding_box: line.boundingBox,
      image_xywh: [x,y,right-x,bottom-y], canvas_xywh: [left,top,Math.min(cr,s.canvas_width)-left,Math.min(cb,s.canvas_height)-top],
      detection_confidence: line.confidence ?? null });
  });
}

export function normalizeGpuOutput(input: unknown, source: OcrSource): OcrLine[] {
  const raw = z.object({
    imginfo: z.object({ img_width: z.number().int().positive(), img_height: z.number().int().positive() }),
    contents: z.array(z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite(), z.string().max(2*1024*1024)])).max(10000),
  }).parse(input);
  return normalizeKotenOutput({ imginfo: raw.imginfo, contents: [raw.contents.map(([x,y,right,bottom,text],index) => ({
    id: String(index), text, boundingBox: [[x,y],[x,bottom],[right,y],[right,bottom]],
  }))] }, source);
}

export function normalizeProviderOutput(provider: "ndlkotenocr-lite" | "ndlkotenocr-ver3", input: unknown, text: string, source: OcrSource) {
  const lines = provider === "ndlkotenocr-ver3" ? normalizeGpuOutput(input, source) : normalizeKotenOutput(input, source);
  if (provider === "ndlkotenocr-ver3" && text !== lines.map(line=>line.text).join("")+"\n")
    throw new Error("GPU OCRの原JSONとTXT本文が一致しません");
  if (!lines.length && text.trim()) throw new Error("OCR行座標と本文が一致しません");
  return lines;
}
