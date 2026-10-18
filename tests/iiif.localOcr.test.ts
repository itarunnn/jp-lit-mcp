import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runIiifCli } from "../src/iiif/cli.js";
import { digest, ocrSource } from "./fixtures/iiif/ocr.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { readWorkspace, saveWorkspace } from "../src/iiif/workspace.js";

const dirs: string[] = [], servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function cli(input: unknown) {
  const cwd = await mkdtemp(path.join(tmpdir(), "iiif-local-request-")); dirs.push(cwd);
  await writeFile(path.join(cwd, "request.json"), JSON.stringify(input));
  let stdout = "";
  const code = await runIiifCli(["--request", "request.json"], {
    cwd, stdout: s => { stdout += s; }, stderr: () => {},
  });
  return { code, ...JSON.parse(stdout) };
}
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "iiif-local-ocr-")); dirs.push(dir);
  const input = path.join(dir, "evidence"); await mkdir(input);
  const image = Buffer.alloc(24);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(image);
  image.write("IHDR", 12); image.writeUInt32BE(150, 16); image.writeUInt32BE(200, 20);
  await writeFile(path.join(input, "region.png"), image);
  const source = { ...ocrSource(), image_sha256: digest(image) };
  const evidencePath = path.join(input, "evidence.json");
  await writeFile(evidencePath, JSON.stringify({ schema_version: "0.1", workspace_id: "w1", items: [{
    evidence_id: "r1", selection: source.selection,
    source: { document_id: "d1", receipt: { sha256: "a".repeat(64) } },
    canvas: { canvas_id: source.selection.canvas_id, width: 1000, height: 2000 },
    crop: { status: "supported", image_xywh: source.original_image_xywh, transform: source.canvas_to_image },
    display_image: { path: "region.png", receipt: { sha256: digest(image) }, width: 150, height: 200,
      original_image_xywh: source.original_image_xywh, canvas_to_image: source.canvas_to_image, scale_x: .25, scale_y: .25 },
    image_permission_confirmed: true,
  }] }));
  // External dependency only: HTTP contract at upstream commit 13ce465, synthetic recognition.
  const state = {
    metadata: { id: "ndl-lite", label: "NDLOCR Lite", ready: true, lines: true, modes: ["layout", "line"] },
    response: { engine: "ndl-lite", width: 150, height: 200, seconds: .125, mode: "layout", region: null,
      text: "舊字", lines: [{ text: "舊字", box: { x: 0, y: 0, w: 50, h: 100 } as {x:number;y:number;w:number;h:number} | null, polygon: null as number[][] | null }] },
    status: 200, redirect: false, hang: false, oversized: false, posts: [] as any[],
  };
  const server = createServer(async (req, res) => {
    if (state.hang) return;
    res.setHeader("Content-Type", "application/json");
    if (state.redirect) { res.writeHead(302, { Location: "http://example.invalid/" }); res.end(); return; }
    if (req.url === "/v1/engines" && req.method === "GET") { res.end(JSON.stringify({ engines: [state.metadata] })); return; }
    if (req.url !== "/v1/ocr" || req.method !== "POST") { res.writeHead(404); res.end(); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    state.posts.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.statusCode = state.status;
    res.end(state.oversized ? "x".repeat(4 * 1024 * 1024 + 1) : JSON.stringify(state.response));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const base_url = `http://127.0.0.1:${port}`;
  const inspect = (extra = {}) => cli({ api_version: "0.1", operation: "inspect_ocr_provider", provider: "local-ocr", base_url, engine_id: "ndl-lite", mode: "layout", ...extra });
  async function prepare() {
    const inspected = await inspect(); expect(inspected.code, JSON.stringify(inspected)).toBe(0);
    const configPath = path.join(dir, "provider.json");
    await writeFile(configPath, JSON.stringify(inspected.result.config));
    return configPath;
  }
  const run = (configPath: string) => cli({ api_version: "0.1", operation: "run_ocr", evidence_path: evidencePath,
    evidence_ids: ["r1"], provider_config_path: configPath, output_dir: path.join(dir, "run") });
  return { dir, image, evidencePath, state, inspect, prepare, run, base_url, server };
}

describe("Local OCR adapter", () => {
  it.each(["layout", "line"])("runs the selected classical engine in %s mode and retains its geometry in the common structure", async mode => {
    const f = await fixture();
    f.state.metadata.id = "ndl-koten-lite"; f.state.metadata.label = "NDL Kotenseki OCR Lite";
    f.state.response.engine = "ndl-koten-lite"; f.state.response.mode = mode;
    const polygon = [[0, 5], [45, 0], [50, 95], [5, 100]];
    f.state.response.lines[0].polygon = polygon;
    const inspected = await f.inspect({ engine_id: "ndl-koten-lite", mode });
    expect(inspected.code, JSON.stringify(inspected)).toBe(0);
    const config = path.join(f.dir, "classical-provider.json");
    await writeFile(config, JSON.stringify(inspected.result.config));
    const result = await f.run(config); expect(result.code, JSON.stringify(result)).toBe(0);
    expect(f.state.posts[0]).toMatchObject({ engine: "ndl-koten-lite", mode });
    const workspacePath = path.join(f.dir, "workspace.json"), importedPath = path.join(f.dir, "imported.json");
    await saveWorkspace(workspacePath, sampleWorkspace(), false);
    expect((await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: workspacePath,
      run_path: result.result.run_path, output_path: importedPath })).code).toBe(0);
    const w = await readWorkspace(importedPath), output = path.join(f.dir, "structure");
    const built = await cli({ api_version: "0.1", operation: "build_book_structure", workspace_path: importedPath,
      text_ids: [w.texts[0].text_id], output_dir: output, profile: "general" });
    expect(built.code, JSON.stringify(built)).toBe(0);
    const structure = JSON.parse(await readFile(path.join(output, "structure.json"), "utf8"));
    expect(structure.lines[0].source_locator.layout).toEqual({ provider: "local-ocr", engine_id: "ndl-koten-lite", mode,
      coordinate_space: "saved_image_pixels", box: f.state.response.lines[0].box, polygon });
    expect(structure.lines[0].canvas_xywh).toEqual([100, 200, 100, 200]);
  });

  it("rejects a different supported engine in a classical response", async () => {
    const f = await fixture(); f.state.metadata.id = "ndl-koten-lite";
    const inspected = await f.inspect({ engine_id: "ndl-koten-lite" });
    expect(inspected.code).toBe(0);
    const config = path.join(f.dir, "provider.json"); await writeFile(config, JSON.stringify(inspected.result.config));
    const result = await f.run(config); expect(result.code).toBe(4);
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    expect(run.items[0].status).toBe("failed");
  });

  it("keeps the selected capability fingerprint distinct from unknown engine and model revisions", async () => {
    const f = await fixture(), result = await f.inspect();
    expect(result.code).toBe(0);
    expect(result.result.engine).toMatchObject({ provider: "local-ocr", engine_id: "ndl-lite", mode: "layout",
      engine_sha256: null, service_version: null, model_version: null, identity_verification: "service_metadata_only" });
    expect(result.result.config.expected_metadata_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("saves exact input and response bytes, imports offline, resumes, and protects source files", async () => {
    const f = await fixture(), config = await f.prepare(), result = await f.run(config);
    expect(result.code, JSON.stringify(result)).toBe(0);
    expect(f.state.posts).toEqual([{ engine: "ndl-lite", mode: "layout", image: f.image.toString("base64") }]);
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    expect(run).toMatchObject({ status: "completed", image_transmission: "loopback", device: "unknown" });
    expect(run.items[0].lines[0].canvas_xywh).toEqual([100, 200, 100, 200]);
    expect(await readFile(path.join(f.dir, "run/input-1.png"))).toEqual(f.image);
    expect(await readFile(path.join(f.dir, "run/item-1/input-1.json"), "utf8")).toBe(JSON.stringify(f.state.response));
    await new Promise<void>(resolve => f.server.close(() => resolve()));
    servers.splice(servers.indexOf(f.server), 1);
    const workspacePath = path.join(f.dir, "workspace.json");
    await saveWorkspace(workspacePath, sampleWorkspace(), false);
    const importedPath = path.join(f.dir, "imported.json");
    const imported = await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: workspacePath,
      run_path: result.result.run_path, output_path: importedPath });
    expect(imported.code, JSON.stringify(imported)).toBe(0);
    const workspace = await readWorkspace(importedPath);
    expect(workspace.texts[0]).toMatchObject({ text: "舊字", origin: "ocr_candidate", verification_state: "unverified" });
    const reimport = await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: importedPath,
      run_path: result.result.run_path, output_path: importedPath, overwrite: true });
    expect(reimport.code).toBe(0); expect(reimport.result.imported).toBe(0);
    const evaluationPath = path.join(f.dir, "evaluation.json");
    await writeFile(evaluationPath, JSON.stringify({ schema_version: "0.1", evaluation_id: "local", workspace_id: "w1",
      cases: [{ case_id: "one", text_id: workspace.texts[0].text_id, reference: null, variants: [], observations: null }] }));
    const reportPath = path.join(f.dir, "report.json");
    const evaluation = await cli({ api_version: "0.1", operation: "evaluate_ocr", workspace_path: importedPath,
      evaluation_path: evaluationPath, output_path: reportPath });
    expect(evaluation.code, JSON.stringify(evaluation)).toBe(0);
    expect(JSON.parse(await readFile(reportPath, "utf8")).cases[0]).toMatchObject({
      engine: { engine_sha256: null }, image_identity: "verified_local_bytes", provenance_validation: "raw_run_verified" });
    const protectedResult = await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: importedPath,
      run_path: result.result.run_path, output_path: path.join(f.dir, "run/input-1.png"), overwrite: true });
    expect(protectedResult.code).not.toBe(0);
    expect(await readFile(path.join(f.dir, "run/input-1.png"))).toEqual(f.image);
    await writeFile(path.join(f.dir, "run/item-1/input-1.json"), "{}");
    const tampered = await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: importedPath,
      run_path: result.result.run_path, output_path: path.join(f.dir, "tampered.json") });
    expect(tampered.code).not.toBe(0);
  });

  it.each([
    "http://example.org:8080", "http://localhost:8080", "http://127.0.0.1.attacker.invalid:8080",
    "http://user:pass@127.0.0.1:8080", "http://127.0.0.1:8080/private", "https://127.0.0.1:8080",
    "http://2130706433:8080", "http://127.0.0.1:8080?token=secret",
  ])("rejects a noncanonical or nonlocal endpoint before sending images: %s", async base_url => {
    const result = await cli({ api_version: "0.1", operation: "inspect_ocr_provider", provider: "local-ocr", base_url });
    expect(result.code).not.toBe(0); expect(result.ok).toBe(false);
  });

  it("rejects unready engines and metadata drift before creating a run or transmitting an image", async () => {
    const f = await fixture(); f.state.metadata.ready = false;
    expect((await f.inspect()).code).not.toBe(0);
    f.state.metadata.ready = true;
    const config = await f.prepare(); f.state.metadata.label = "changed";
    expect((await f.run(config)).code).not.toBe(0);
    expect(f.state.posts).toHaveLength(0);
    await expect(access(path.join(f.dir, "run"))).rejects.toThrow();
  });

  it("rejects a mode unavailable in the engine descriptor", async () => {
    const f = await fixture(); f.state.metadata.modes = ["line"];
    expect((await f.inspect()).code).not.toBe(0);
  });

  it.each(["engine", "dimensions", "mode", "region", "box", "text", "status", "oversized"])("keeps a failed run and raw evidence for a bad %s response", async condition => {
    const f = await fixture(), config = await f.prepare();
    if (condition === "engine") f.state.response.engine = "paddle-vl";
    if (condition === "dimensions") f.state.response.width = 151;
    if (condition === "mode") f.state.response.mode = "line";
    if (condition === "region") (f.state.response as any).region = { x: 0, y: 0, w: 1, h: 1 };
    if (condition === "box") f.state.response.lines[0].box!.w = 151;
    if (condition === "text") f.state.response.text = "different";
    if (condition === "status") f.state.status = 409;
    if (condition === "oversized") f.state.oversized = true;
    const result = await f.run(config);
    expect(result.code).toBe(4); expect(result.result.status).toBe("failed");
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    expect(run.items[0]).toMatchObject({ status: "failed", text: null, lines: [] });
    expect(await readFile(path.join(f.dir, "run/input-1.png"))).toEqual(f.image);
    if (condition !== "oversized") await access(path.join(f.dir, "run/item-1/input-1.json"));
  });

  it("retains unlocated text without inventing a line rectangle", async () => {
    const f = await fixture(), config = await f.prepare(); f.state.response.lines[0].box = null;
    const result = await f.run(config); expect(result.code).toBe(0);
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    expect(run.items[0]).toMatchObject({ text: "舊字", lines: [] });
    expect(run.items[0].diagnostics.length).toBeGreaterThan(0);
    const workspacePath = path.join(f.dir, "workspace.json");
    await saveWorkspace(workspacePath, sampleWorkspace(), false);
    const output = path.join(f.dir, "unlocated.json");
    const imported = await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: workspacePath,
      run_path: result.result.run_path, output_path: output });
    expect(imported.code).toBe(0);
    expect((await readWorkspace(output)).texts[0]).toMatchObject({ text: "舊字", ocr_provenance: { lines: [] } });
  });

  it("uses explicit line mode and maps its image rectangle to the selected Canvas region", async () => {
    const f = await fixture(), inspected = await f.inspect({ mode: "line" });
    expect(inspected.code).toBe(0);
    const configPath = path.join(f.dir, "provider.json");
    await writeFile(configPath, JSON.stringify(inspected.result.config));
    f.state.response.mode = "line"; f.state.response.lines[0].box = { x: 0, y: 0, w: 150, h: 200 };
    const result = await f.run(configPath); expect(result.code).toBe(0);
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    expect(run.items[0].lines[0].canvas_xywh).toEqual([100, 200, 300, 400]);
    expect(f.state.posts[0].mode).toBe("line");
  });

  it("reports partially missing coordinates while retaining the full text and located lines", async () => {
    const f = await fixture(), config = await f.prepare();
    f.state.response.lines.push({ text: "追加", box: null, polygon: null });
    f.state.response.text = "舊字\n追加";
    const result = await f.run(config); expect(result.code).toBe(0);
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    expect(run.items[0].text).toBe("舊字\n追加");
    expect(run.items[0].lines).toHaveLength(1);
    expect(run.items[0].diagnostics.length).toBeGreaterThan(0);
  });

  it("detects alteration of the saved capability descriptor during offline import", async () => {
    const f = await fixture(), config = await f.prepare(), result = await f.run(config);
    expect(result.code).toBe(0);
    const run = JSON.parse(await readFile(result.result.run_path, "utf8"));
    run.engine.metadata.label = "altered";
    await writeFile(result.result.run_path, JSON.stringify(run));
    const workspacePath = path.join(f.dir, "workspace.json");
    await saveWorkspace(workspacePath, sampleWorkspace(), false);
    const imported = await cli({ api_version: "0.1", operation: "import_ocr", workspace_path: workspacePath,
      run_path: result.result.run_path, output_path: path.join(f.dir, "altered.json") });
    expect(imported.code).not.toBe(0);
  });

  it("does not follow redirects", async () => {
    const f = await fixture(); f.state.redirect = true;
    const result = await f.inspect(); expect(result.code).not.toBe(0);
  });

  it("bounds the wait for a nonresponsive local service", async () => {
    const f = await fixture(); f.state.hang = true;
    const result = await f.inspect({ timeout_ms: 1000 }); expect(result.code).not.toBe(0);
  });
});
