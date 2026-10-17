import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { digest, ocrSource } from "./fixtures/iiif/ocr.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { parseNdlOcrXml } from "../src/iiif/ndlOcr.js";

const boundary = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("node:child_process", async importOriginal => {
  const original = await importOriginal<typeof import("node:child_process")>();
  return { ...original, execFile: Object.assign(vi.fn(), { [Symbol.for("nodejs.util.promisify.custom")]: boundary.command }) };
});
const imageId = "sha256:" + "e".repeat(64), dirs: string[] = [];
// 上流b844abfのXML構造。LINEのORDERは文書順と異なり、BLOCKはORDERを持たない。
const xml = `<OCRDATASET><PAGE WIDTH="150" HEIGHT="200" IMAGENAME="input-1.png"><TEXTBLOCK CONF=".9"><LINE X="50" Y="0" WIDTH="50" HEIGHT="100" STRING="語釋" ORDER="1" TYPE="本文" CONF=".8" TITLE="FALSE"/><LINE X="0" Y="0" WIDTH="50" HEIGHT="100" STRING="見出し&amp;𠮷" ORDER="0" TYPE="本文" CONF=".9" TITLE="TRUE"/></TEXTBLOCK><BLOCK X="100" Y="0" WIDTH="10" HEIGHT="20" STRING="柱" TYPE="柱" CONF=".7"/></PAGE></OCRDATASET>`;
const metadata = { python_version: "3.10", torch_version: "2.1.1", cuda_version: "12.1", gpu: "synthetic GPU", files: [
  "main.py", "config.yml", "cli/core/inference.py", "submodules/ndl_layout/models/ndl_retrainmodel.pth",
  "submodules/text_recognition_lightning/models/resnet-orient2.ckpt", "submodules/text_recognition_lightning/ndldata/mojilist_NDL.txt",
].map((p, i) => ({ path: p, sha256: String(i).repeat(64) })) };
let mode = "ok", argsSeen: string[] = [];
beforeEach(() => {
  mode = "ok"; argsSeen = []; boundary.command.mockReset();
  boundary.command.mockImplementation(async (_file: string, args: string[]) => {
    if (args.includes("inspect")) return { stdout: imageId, stderr: "" };
    if (args.includes("-c")) return { stdout: JSON.stringify(mode === "drift" ? { ...metadata, gpu: "changed" } : metadata), stderr: "" };
    if (args.includes("rm")) return { stdout: "", stderr: "" };
    argsSeen = args;
    if (mode === "timeout") throw Object.assign(new Error("timeout"), { killed: true });
    const out = args.find(a => a.endsWith(",target=/out"))!.slice("type=bind,source=".length, -",target=/out".length);
    const native = path.join(out, "native", "input-1"); await mkdir(path.join(native, "xml"), { recursive: true }); await mkdir(path.join(native, "txt"));
    if (mode !== "missing") await writeFile(path.join(native, "xml", "input-1.sorted.xml"), mode === "bad_dimensions" ? xml.replace('WIDTH="150"', 'WIDTH="151"') : xml);
    await writeFile(path.join(native, "txt", "input-1_main.txt"), "native subset\n");
    return { stdout: "synthetic complete", stderr: "" };
  });
});
afterEach(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }); });

it("keeps XML coordinates, native layout attributes and ORDER including text-bearing blocks", () => {
  const result = parseNdlOcrXml(xml, ocrSource(), "input-1.png");
  expect(result.text).toBe("見出し&𠮷\n語釋\n柱\n");
  expect(result.raw.contents[0][0]).toMatchObject({ text: "見出し&𠮷", native: { type: "本文", order: 0, title: "TRUE" } });
  expect(result.lines[0].canvas_xywh).toEqual([100,200,100,200]);
  expect(parseNdlOcrXml('<?xml version="1.0" encoding="UTF-8"?>\n' + xml, ocrSource(), "input-1.png").text).toBe(result.text);
});
it.each([
  xml.replace('WIDTH="150"', 'WIDTH="151"'), xml.replace('IMAGENAME="input-1.png"', 'IMAGENAME="other.png"'),
  xml.replace('X="50"', 'X="149"'), xml.replace('ORDER="1"', 'ORDER="0"'),
  xml.replace('WIDTH="50"', 'WIDTH="-50"'),
  xml.replace(' STRING="語釋"', ''), xml.replace('</OCRDATASET>', '<PAGE/></OCRDATASET>'),
  '<!DOCTYPE OCRDATASET [<!ENTITY test "x">]>' + xml, xml.slice(0, -1),
])("rejects a mismatched or incomplete native XML", bad => {
  expect(() => parseNdlOcrXml(bad, ocrSource(), "input-1.png")).toThrow();
});

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "ndlocr-full-")); dirs.push(dir);
  const source = ocrSource(), png = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.write("IHDR", 12); png.writeUInt32BE(150, 16); png.writeUInt32BE(200, 20); await writeFile(path.join(dir, "input.png"), png);
  const evidence = { schema_version: "0.1", workspace_id: "w1", items: [{ evidence_id: "r1", selection: source.selection,
    source: { document_id: "d1", receipt: { sha256: source.manifest_sha256 } }, canvas: { canvas_id: source.selection.canvas_id, width: 1000, height: 2000 },
    crop: { status: "supported", image_xywh: source.original_image_xywh, transform: source.canvas_to_image }, image_permission_confirmed: true,
    display_image: { path: "input.png", receipt: { sha256: digest(png) }, width: 150, height: 200, original_image_xywh: source.original_image_xywh,
      canvas_to_image: source.canvas_to_image, scale_x: .25, scale_y: .25 } }] };
  const evidencePath = path.join(dir, "evidence.json"); await writeFile(evidencePath, JSON.stringify(evidence));
  const api = await import("../src/iiif/ocrRunner.js");
  const inspected = await api.inspectOcrProvider({ provider: "ndlocr-ver2", docker_path: process.execPath, image_id: imageId });
  const config = path.join(dir, "provider.json"); await writeFile(config, JSON.stringify(inspected.config));
  return { dir, api, request: { evidence_path: evidencePath, evidence_ids: ["r1"], provider_config_path: config, output_dir: path.join(dir, "run"), allow_existing_text: false } };
}
it("runs the opt-in full engine offline and imports its XML-verified output", async () => {
  const f = await fixture(), result = await f.api.runOcr(f.request); expect(result.status).toBe("completed");
  expect(argsSeen).toContain("never"); expect(argsSeen).toContain("none");
  expect(argsSeen.slice(-10)).toEqual([imageId, "main.py", "infer", "/input/input-1.png", "/out/native", "-s", "f", "-p", "2..3", "-x"]);
  const { importOcr } = await import("../src/iiif/ocrImport.js");
  const w = (await importOcr(sampleWorkspace(), result.run_path)).workspace;
  expect(w.texts[0]).toMatchObject({ text: "見出し&𠮷\n語釋\n柱\n", ocr_provenance: { engine: { provider: "ndlocr-ver2", model_version: "2.1" } } });
  expect(await readFile(path.join(f.request.output_dir, "item-1/input-1.xml"), "utf8")).toBe(xml);
  // derived JSONとrunを一緒に変更しても、保存した原XMLとの不一致を検出する。
  const run = JSON.parse(await readFile(result.run_path, "utf8"));
  const artifact = run.items[0].artifacts.find((a: any) => a.path.endsWith("input-1.json"));
  const raw = JSON.parse(await readFile(path.join(f.request.output_dir, artifact.path), "utf8")); raw.contents[0][0].native.title = "FALSE";
  const changed = JSON.stringify(raw); await writeFile(path.join(f.request.output_dir, artifact.path), changed); artifact.sha256 = digest(changed);
  await writeFile(result.run_path, JSON.stringify(run));
  await expect(importOcr(sampleWorkspace(), result.run_path)).rejects.toThrow(/XML/);
});
it.each(["missing", "bad_dimensions", "timeout"])("retains failed runs for missing, transformed or interrupted output: %s", async value => {
  const f = await fixture(); mode = value; const result = await f.api.runOcr(f.request); expect(result.status).toBe("failed");
  if (value === "timeout") {
    const cleanup = boundary.command.mock.calls.find(([, args]) => args.includes("rm"))![1];
    expect(cleanup.slice(-1)).toEqual([argsSeen[argsSeen.indexOf("--name") + 1]]);
  }
});
it("rejects provider drift before creating the run", async () => {
  const f = await fixture(); mode = "drift";
  await expect(f.api.runOcr(f.request)).rejects.toThrow(/hash/);
});
