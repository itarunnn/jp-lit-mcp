import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { digest, ocrCandidate, ocrSource } from "./fixtures/iiif/ocr.js";
import { normalizeKotenOutput } from "../src/iiif/ocr.js";
import { normalizeLocalOcrOutput } from "../src/iiif/localOcr.js";
import { localOcrMetadataHash } from "../src/iiif/localOcrSchemas.js";
import { importOcr } from "../src/iiif/ocrImport.js";
import { runIiifCli } from "../src/iiif/cli.js";

const dirs: string[] = [];
afterEach(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }); });
async function fixture(local = false, options: { shifted?: boolean; mismatch?: boolean; edge?: boolean } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "ocr-tei-")); dirs.push(dir);
  const root = path.join(dir, "run"); await mkdir(root);
  const image = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(image);
  image.write("IHDR", 12); image.writeUInt32BE(150, 16); image.writeUInt32BE(200, 20);
  const source = { ...ocrSource(), image_sha256: digest(image) };
  if (options.shifted) source.original_image_xywh[0] = 201;
  if (options.edge) {
    source.selection.xywh = [900,200,100,400]; source.original_image_xywh = [900,400,101,800];
    source.canvas_to_image.scale_x = 1.001; source.scale_x = 150 / 101;
  }
  const meta = { id: "ndl-lite", label: "NDLOCR Lite", ready: true, lines: true, modes: ["layout"] };
  const engine: any = local ? { provider: "local-ocr", runtime: "http", base_url: "http://127.0.0.1:1", engine_id: "ndl-lite", mode: "layout",
    metadata: meta, metadata_sha256: localOcrMetadataHash(meta), identity_verification: "service_metadata_only", engine_sha256: null, service_version: null, model_version: null } : ocrCandidate().ocr_provenance.engine;
  const raw: any = local ? { engine: "ndl-lite", width: 150, height: 200, seconds: 1, mode: "layout", region: null, text: "見出し\n位置なし",
    lines: [{ text: "見出し", box: { x: 0, y: 0, w: 50, h: 100 }, polygon: null }, { text: "位置なし", box: null, polygon: null }] } :
    { imginfo: { img_width: 150, img_height: 200 }, contents: [[{ id: 0, text: "語<&𠮷", boundingBox: [[0,0],[0,100],[50,0],[50,100]] },
      { id: 1, text: "語釋", boundingBox: [[50,0],[50,200],[100,0],[100,200]] }]] };
  const text = local ? raw.text : options.mismatch ? "別の本文\n" : "語<&𠮷\n語釋\n";
  const lines = local ? normalizeLocalOcrOutput(raw, text, source, engine) : normalizeKotenOutput(raw, source);
  const evidence = { schema_version: "0.1", workspace_id: "w1", items: [{ evidence_id: "r1", selection: source.selection,
    source: { document_id: "d1", receipt: { sha256: source.manifest_sha256 } }, canvas: { canvas_id: source.selection.canvas_id, width: 1000, height: 2000 },
    crop: { status: "supported", image_xywh: source.original_image_xywh, transform: source.canvas_to_image },
    display_image: { path: "input.png", receipt: { sha256: source.image_sha256 }, width: 150, height: 200, original_image_xywh: source.original_image_xywh,
      canvas_to_image: source.canvas_to_image, scale_x: source.scale_x, scale_y: source.scale_y }, image_permission_confirmed: true }] };
  const files = { "input.png": image, "raw.json": Buffer.from(JSON.stringify(raw)), "raw.txt": Buffer.from(text) };
  for (const [name, bytes] of Object.entries(files)) await writeFile(path.join(root, name), bytes);
  const evidenceBytes = Buffer.from(JSON.stringify(evidence)); await writeFile(path.join(root, "evidence.json"), evidenceBytes);
  const runPath = path.join(root, "run.json");
  const run: any = { schema_version: "0.1", run_id: "one", status: "completed", device: local ? "unknown" : "cpu", image_transmission: local ? "loopback" : "none", engine,
    evidence_path: path.join(root, "evidence.json"), evidence_sha256: digest(evidenceBytes), items: [{ status: "completed", source, text, lines,
      started_at: "2026-10-17T00:00:00Z", finished_at: "2026-10-17T00:00:01Z", duration_ms: 1000, error: null, diagnostics: [],
      artifacts: Object.entries(files).map(([name, bytes]) => ({ path: name, sha256: digest(bytes) })) }] };
  await writeFile(runPath, JSON.stringify(run));
  const base = sampleWorkspace(); base.regions[0].selection = source.selection;
  const workspace = (await importOcr(base, runPath)).workspace;
  const workspacePath = path.join(dir, "workspace.json"); await writeFile(workspacePath, JSON.stringify(workspace));
  const output = path.join(dir, "export");
  async function cli(extra = {}) {
    const req = path.join(dir, "request.json"); let stdout = "";
    await writeFile(req, JSON.stringify({ api_version: "0.1", operation: "export_ocr_tei", workspace_path: workspacePath, text_ids: [workspace.texts[0].text_id], output_dir: output, ...extra }));
    const code = await runIiifCli(["--request", req], { cwd: dir, stdout: s => { stdout += s; }, stderr: () => {} });
    return { code, ...JSON.parse(stdout) };
  }
  return { dir, root, output, text, image, workspace, workspacePath, runPath, run, cli };
}

it("exports positioned TEI and a DB line index that roundtrips through the real TEI reader", async () => {
  const f = await fixture(), result = await f.cli(); expect(result.code, JSON.stringify(result)).toBe(0);
  const xml = await readFile(result.result.tei_path, "utf8");
  const index = JSON.parse(await readFile(result.result.index_path, "utf8"));
  expect(index.items[0].text).toBe(f.text);
  expect(index.items[0].lines[0]).toMatchObject({ text: "語<&𠮷", order: 1, image_xywh: [0,0,50,100], canvas_xywh: [100,200,100,200] });
  expect(await readFile(path.join(f.output, index.items[0].image.path))).toEqual(f.image);
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: false, parseTagValue: false }).parse(xml);
  expect(parsed.TEI.text.body.ab.seg[0]["#text"]).toBe("語<&𠮷");
  const req = path.join(f.dir, "link-request.json"); let stdout = "";
  await writeFile(req, JSON.stringify({ api_version: "0.1", operation: "link_tei", workspace_path: f.workspacePath,
    output_path: path.join(f.dir, "linked.json"), file_path: result.result.tei_path, expected_sha256: digest(xml), document_id: "d1", limit: 100 }));
  const code = await runIiifCli(["--request", req], { cwd: f.dir, stdout: s => { stdout += s; }, stderr: () => {} });
  expect(code, stdout).toBe(0);
  const linked = JSON.parse(await readFile(path.join(f.dir, "linked.json"), "utf8"));
  const line = linked.tei_links.find((l: any) => l.reference.source_locator.xml_id === index.items[0].lines[0].xml_id);
  expect(line.target.xywh).toEqual([100,200,100,200]);
  expect(JSON.stringify(line.reference.source_content)).toContain("語<&𠮷");
  expect(linked.tei_links.find((l: any) => l.reference.source_content?.name?.endsWith("}pb")).target.xywh).toEqual([100,200,300,400]);
}, 60000);

it("retains unlocated lines without inventing zones or dropping text", async () => {
  const f = await fixture(true), result = await f.cli(); expect(result.code, JSON.stringify(result)).toBe(0);
  const index = JSON.parse(await readFile(result.result.index_path, "utf8"));
  expect(index.items[0].text).toBe(f.text);
  expect(index.items[0].lines[1]).toMatchObject({ text: "位置なし", image_xywh: null, canvas_xywh: null, zone_id: null });
  const xml = await readFile(result.result.tei_path, "utf8"); expect(xml).toContain("位置なし");
  expect((xml.match(/<zone /g) ?? [])).toHaveLength(1);
});

it("protects prior output and verifies the original run before exporting", async () => {
  const f = await fixture(); expect((await f.cli()).code).toBe(0);
  const previous = await readFile(path.join(f.output, "transcription.xml"));
  expect((await f.cli()).code).not.toBe(0); expect(await readFile(path.join(f.output, "transcription.xml"))).toEqual(previous);
  await writeFile(path.join(f.root, "raw.json"), "{}");
  const other = path.join(f.dir, "tampered"); expect((await f.cli({ output_dir: other })).code).not.toBe(0);
  await expect(access(other)).rejects.toThrow();
});

it("maps the observed crop origin including rounding instead of stretching the requested selection", async () => {
  const f = await fixture(false, { shifted: true }), result = await f.cli(); expect(result.code, JSON.stringify(result)).toBe(0);
  const index = JSON.parse(await readFile(result.result.index_path, "utf8"));
  expect(index.items[0].surface_canvas_xywh).toEqual([100.5,200,300,400]);
  expect(index.items[0].lines[0].canvas_xywh).toEqual([100.5,200,100,200]);
  expect(await readFile(result.result.tei_path, "utf8")).toContain("#xywh=100.5,200,300,400");
});

it("rejects unalignable full text and duplicate candidate IDs before creating output", async () => {
  const f = await fixture(false, { mismatch: true });
  expect((await f.cli()).error).toMatch(/全文と行本文/);
  await expect(access(f.output)).rejects.toThrow();
  const g = await fixture(); expect((await g.cli({ text_ids: [g.workspace.texts[0].text_id, g.workspace.texts[0].text_id] })).code).not.toBe(0);
  await expect(access(g.output)).rejects.toThrow();
});

it("roundtrips a right-edge crop with floating-point noise through the TEI reader", async () => {
  const f = await fixture(false, { edge: true }), result = await f.cli(); expect(result.code, JSON.stringify(result)).toBe(0);
  const index = JSON.parse(await readFile(result.result.index_path, "utf8"));
  const crop = index.items[0].surface_canvas_xywh; expect(crop[0] + crop[2]).toBeLessThanOrEqual(1000);
  const req = path.join(f.dir, "edge-request.json"); let stdout = "";
  await writeFile(req, JSON.stringify({ api_version: "0.1", operation: "link_tei", workspace_path: f.workspacePath,
    output_path: path.join(f.dir, "edge-linked.json"), file_path: result.result.tei_path, expected_sha256: result.result.tei_sha256, document_id: "d1", limit: 100 }));
  expect(await runIiifCli(["--request", req], { cwd: f.dir, stdout: s => { stdout += s; }, stderr: () => {} }), stdout).toBe(0);
  const linked = JSON.parse(await readFile(path.join(f.dir, "edge-linked.json"), "utf8"));
  expect(linked.tei_links.every((l: any) => l.state === "resolved")).toBe(true);
  const first = linked.tei_links.find((l: any) => l.reference.source_locator.xml_id === index.items[0].lines[0].xml_id);
  first.target.xywh.forEach((value: number, i: number) => expect(value).toBeCloseTo(index.items[0].lines[0].canvas_xywh[i], 10));
}, 60000);
