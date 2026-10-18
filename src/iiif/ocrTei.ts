import path from "node:path";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { readWorkspace } from "./workspace.js";
import { protectWorkspaceSources } from "./outputProtection.js";
import { resolveOcrEvaluationSource } from "./ocrEvaluationSource.js";
import { ocrRunSchema, type OcrLine } from "./ocrSchemas.js";
import { ocrDigest, readOcrFile, resolveOcrArtifact } from "./ocrRunner.js";
import type { IiifWorkspace } from "./types.js";

function xml(value: string) {
  if (/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(value)) throw new Error("XMLに保存できない文字があります");
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;");
}
function delimiters(text: string, lines: string[]) {
  for (const separator of ["\n", "", "\r\n"]) for (const tail of ["", "\n", "\r\n"]) {
    if (lines.join(separator) + tail === text) return { separator, tail };
  }
  throw new Error("OCR全文と行本文が一致しません。原出力を確認してください");
}

/** 原出力を検証して、画像・TEI・DB向け行indexを新規ディレクトリに保存する。 */
export async function exportOcrTei(request: { workspace_path: string; text_ids: string[]; output_dir: string; title?: string }) {
  const w = await readWorkspace(request.workspace_path);
  if (!request.text_ids.length || request.text_ids.length > 4 || new Set(request.text_ids).size !== request.text_ids.length) throw new Error("OCR候補を重複なしで1〜4件指定してください");
  await protectWorkspaceSources(request.output_dir, w, [request.workspace_path]);
  const verified = new Map<string, IiifWorkspace>();
  const surfaces: string[] = [], bodies: string[] = [], items = [], images: { path: string; bytes: Buffer }[] = [];
  for (const [i, id] of request.text_ids.entries()) {
    const candidate = w.texts.find(t => t.text_id === id);
    if (!candidate?.ocr_provenance) throw new Error("位置情報を持つOCR候補を指定してください");
    await resolveOcrEvaluationSource(w, candidate, request.output_dir, verified);
    const p = candidate.ocr_provenance, s = p.source;
    const run = ocrRunSchema.parse(JSON.parse((await readOcrFile(p.run_path, 32 * 1024 * 1024)).toString("utf8").replace(/^\uFEFF/, "")));
    const item = run.items.find(item => item.source.evidence_id === s.evidence_id)!;
    const imageArtifact = item.artifacts.find(a => /\.(png|jpg)$/i.test(a.path))!;
    const imageBytes = await readOcrFile(await resolveOcrArtifact(path.dirname(p.run_path), imageArtifact.path));
    if (ocrDigest(imageBytes) !== s.image_sha256) throw new Error("OCR画像のhashが一致しません");
    const imagePath = `images/page-${i + 1}${path.extname(imageArtifact.path).toLowerCase()}`;
    const sid = `surface-${i + 1}`, prefix = `page-${i + 1}`;
    const [ix, iy, iw, ih] = s.original_image_xywh, { scale_x: sx, scale_y: sy } = s.canvas_to_image;
    const left = ix / sx, top = iy / sy, right = (ix + iw) / sx, bottom = (iy + ih) / sy;
    // 行正規化と同じ誤差範囲だけを補正し、実際にCanvas外のcropは診断する。
    if (left < -1e-7 || top < -1e-7 || right > s.canvas_width + 1e-7 || bottom > s.canvas_height + 1e-7) throw new Error("TEI surfaceの画像範囲がCanvasの外にあります");
    const x = Math.max(0, left), y = Math.max(0, top);
    const crop = [x, y, Math.min(s.canvas_width, right) - x, Math.min(s.canvas_height, bottom) - y];
    let allLines: { text: string; located: OcrLine | null; line_id: string; layout?: Record<string, unknown> }[] = p.lines.map(l => ({ text: l.text, located: l, line_id: l.line_id }));
    if (p.engine.provider === "local-ocr") {
      const artifact = item.artifacts.find(a => a.path.endsWith(".json"))!;
      const raw = JSON.parse((await readOcrFile(await resolveOcrArtifact(path.dirname(p.run_path), artifact.path))).toString("utf8"));
      allLines = raw.lines.map((line: { text: string; box: unknown; polygon: unknown }, index: number) => ({
        text: line.text, line_id: String(index), located: p.lines.find(l => l.line_id === String(index)) ?? null,
        layout: { provider: "local-ocr", engine_id: p.engine.provider === "local-ocr" ? p.engine.engine_id : null,
          mode: raw.mode, coordinate_space: "saved_image_pixels", box: line.box, polygon: line.polygon },
      }));
    }
    if (p.engine.provider === "ndlocr-ver2") {
      const artifact = item.artifacts.find(a => a.path.endsWith(".json") && !a.path.endsWith("opt.json"))!;
      const raw = JSON.parse((await readOcrFile(await resolveOcrArtifact(path.dirname(p.run_path), artifact.path))).toString("utf8"));
      for (const line of allLines) line.layout = raw.contents[0].find((l: { id: string }) => l.id === line.line_id).native;
    }
    // 本文のみの応答も保持する。位置が欠ける行へzoneを割り当てない。
    if (!allLines.length && candidate.text) allLines = [{ text: candidate.text, line_id: "text-only", located: null }];
    const { separator, tail } = delimiters(candidate.text, allLines.map(l => l.text));
    const lines = allLines.map((line, j) => ({ order: j + 1, line_id: line.line_id, xml_id: `${prefix}-line-${j + 1}`,
      zone_id: line.located ? `${prefix}-zone-${j + 1}` : null, text: line.text,
      image_xywh: line.located?.image_xywh ?? null, canvas_xywh: line.located?.canvas_xywh ?? null,
      bounding_box: line.located?.bounding_box ?? null, detection_confidence: line.located?.detection_confidence ?? null,
      ...(line.layout ? { layout: line.layout } : {}) }));
    const zones = lines.filter(l => l.image_xywh).map(l => {
      const [x, y, width, height] = l.image_xywh!;
      return `<zone xml:id="${l.zone_id}" type="line" ulx="${x}" uly="${y}" lrx="${x + width}" lry="${y + height}"/>`;
    }).join("");
    surfaces.push(`<surface xml:id="${sid}" sameAs="${xml(s.selection.canvas_id)}#xywh=${crop.join(",")}" ulx="0" uly="0" lrx="${s.image_width}" lry="${s.image_height}"><graphic url="${imagePath}" width="${s.image_width}px" height="${s.image_height}px"/>${zones}</surface>`);
    const body = lines.map((line, j) => `${j ? "<lb/>" + xml(separator) : ""}<seg xml:id="${line.xml_id}" type="ocr-line" n="${xml(line.line_id)}"${line.zone_id ? ` facs="#${line.zone_id}"` : ""}>${xml(line.text)}</seg>`).join("") + xml(tail);
    bodies.push(`<pb n="${i + 1}" facs="#${sid}"/><ab xml:space="preserve">${body}</ab>`);
    images.push({ path: imagePath, bytes: imageBytes });
    items.push({ text_id: id, verification_state: "unverified", text: candidate.text, source: s, engine: p.engine,
      image: { path: imagePath, sha256: s.image_sha256 }, surface_id: sid, surface_canvas_xywh: crop,
      run_path: p.run_path, run_sha256: p.run_sha256, source_sha256: candidate.source_sha256, lines,
      diagnostics: lines.some(l => !l.zone_id) ? ["unlocated_lines_preserved"] : [] });
  }
  const tei = `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>${xml(request.title ?? "位置情報付きOCR候補")}</title><respStmt><resp>自動OCR候補のTEI変換</resp><name>jp-lit-iiif</name></respStmt></titleStmt><publicationStmt><p>原画像との校合前のOCR候補。出典・engine・座標変換はprovenance.jsonとlines.jsonに記録。</p></publicationStmt><sourceDesc><p><ref target="provenance.json">OCR原出力とIIIF出典</ref></p></sourceDesc></fileDesc></teiHeader><facsimile>${surfaces.join("")}</facsimile><text><body>${bodies.join("")}</body></text></TEI>\n`;
  const index = { schema_version: "0.1", coordinate_space: { image_xywh: "saved_image_pixels", canvas_xywh: "iiif_canvas" }, reading_order: "ocr_output_order", items };
  // 検証がすべて済んでから新規出力先を作る。既存bundleは保全する。
  await mkdir(path.dirname(request.output_dir), { recursive: true });
  try { await mkdir(request.output_dir); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("TEIには新しい保存先を指定してください"); throw error; }
  const root = await realpath(request.output_dir); await mkdir(path.join(root, "images"));
  for (const image of images) await writeFile(path.join(root, image.path), image.bytes, { flag: "wx" });
  const tei_path = path.join(root, "transcription.xml"), index_path = path.join(root, "lines.json"), provenance_path = path.join(root, "provenance.json");
  await writeFile(tei_path, tei, { flag: "wx" });
  await writeFile(index_path, JSON.stringify(index, null, 2) + "\n", { flag: "wx" });
  await writeFile(provenance_path, JSON.stringify({ schema_version: "0.1", workspace_id: w.workspace_id, created_at: new Date().toISOString(),
    tei_sha256: ocrDigest(tei), index_sha256: ocrDigest(JSON.stringify(index, null, 2) + "\n"),
    items: items.map(item => ({ text_id: item.text_id, run_path: item.run_path, run_sha256: item.run_sha256, source: item.source, engine: item.engine })) }, null, 2) + "\n", { flag: "wx" });
  return { tei_path, index_path, provenance_path, tei_sha256: ocrDigest(tei), items: items.length, lines: items.reduce((n, item) => n + item.lines.length, 0) };
}
