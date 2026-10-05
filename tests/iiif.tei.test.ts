import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { runIiifCli } from "../src/iiif/cli.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";

const canvas = "https://example.org/canvas/1";
describe("TEI to IIIF linking", () => {
  async function run(xml: string, extra: Record<string, unknown> = {}) {
    const dir = await mkdtemp(path.join(tmpdir(), "iiif-tei-"));
    try {
      const w = sampleWorkspace();
      const c = w.documents[0].canvases[0];
      c.canvas_id = canvas;
      c.images[0].target = canvas;
      w.windows[0].canvas_id = canvas;
      w.regions[0].selection.canvas_id = canvas;
      const source = path.join(dir, "資料.xml"), output = path.join(dir, "linked.json");
      await writeFile(source, xml);
      await writeFile(path.join(dir, "workspace.json"), JSON.stringify(w));
      await writeFile(path.join(dir, "request.json"), JSON.stringify({
        api_version: "0.1", operation: "link_tei", workspace_path: path.join(dir, "workspace.json"),
        output_path: output, file_path: source, expected_sha256: createHash("sha256").update(xml).digest("hex"),
        document_id: w.documents[0].document_id, ...extra,
      }));
      let stdout = "", stderr = "";
      const code = await runIiifCli(["--request", "request.json"], {
        cwd: dir, stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; },
      });
      return { code, stdout, stderr, w: code === 0 ? validateWorkspace(JSON.parse(await readFile(output, "utf8"))) : null };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  it("opens explicit Canvas rectangles while preserving both choice readings", async () => {
    const result = await run(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p xml:id="verse" facs="${canvas}#xywh=100,200,300,400">前<choice><orig>舊</orig><reg>旧</reg></choice>後</p></body></text></TEI>`);
    expect(result.code, result.stderr + result.stdout).toBe(0);
    const link = result.w!.tei_links![0];
    expect(link.state).toBe("resolved");
    expect(link.target?.xywh).toEqual([100, 200, 300, 400]);
    expect(link.reference.source_locator.xml_id).toBe("verse");
    expect(JSON.stringify(link.reference.source_content)).toContain("舊");
    expect(JSON.stringify(link.reference.source_content)).toContain("旧");
    expect(link.collations).toEqual([]);
  }, 60000);
  it("converts a declared surface space with a nonzero origin to Canvas space", async () => {
    const result = await run(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><facsimile><surface xml:id="s" ulx="10" uly="20" lrx="110" lry="220"><graphic url="page.jpg"/><zone xml:id="z" ulx="20" uly="40" lrx="50" lry="100"/></surface></facsimile><text><body><p facs="#z">本文</p></body></text></TEI>`, {
      surface_bindings: [{ surface_xpath: "/t:TEI[1]/t:facsimile[1]/t:surface[1]", canvas_id: canvas }],
    });
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(result.w!.tei_links![0].target?.xywh).toEqual([100, 200, 300, 600]);
    expect(result.w!.tei_links![0].target?.basis).toBe("surface_binding");
  }, 60000);
  it("preserves unresolved references and never treats a matching image URL as confirmed", async () => {
    const w = sampleWorkspace();
    const image = w.documents[0].canvases[0].images[0].image_id;
    const result = await run(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><surface xml:id="s"><graphic url="${image}"/></surface><p facs="#s #missing"/><div xml:base="other.xml"><p facs="${canvas}"/></div></TEI>`);
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(result.w!.tei_links!.map((l) => l.state)).toEqual(["candidate", "unresolved", "unresolved"]);
    expect(result.w!.tei_links![0].candidates[0].canvas_id).toBe(canvas);
    expect(result.w!.tei_links![0].target).toBeNull();
  }, 60000);
  it("uses an explicit surface sameAs Canvas declaration with its coordinate space", async () => {
    const result = await run(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><surface xml:id="s" sameAs="${canvas}" ulx="0" uly="0" lrx="2000" lry="1336"><zone xml:id="z" ulx="1000" uly="0" lrx="2000" lry="1336"/></surface><pb facs="#z"/></TEI>`);
    expect(result.code, result.stdout).toBe(0);
    expect(result.w!.tei_links![0].target?.xywh).toEqual([500, 0, 500, 2000]);
    expect(result.w!.tei_links![0].target?.basis).toBe("surface_same_as");
    expect(result.w!.tei_links![0].diagnostics).toContain("milestone_content_not_expanded");
  }, 60000);
  it("keeps polygons and rotations unconfirmed, even with a surface binding", async () => {
    const result = await run(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><surface xml:id="s" ulx="0" uly="0" lrx="100" lry="200"><zone xml:id="z" points="0,0 10,10 0,10" rotate="15"/></surface><p facs="#z"/><p facs="${canvas}#xywh=999,1,10,10"/></TEI>`, {
      surface_bindings: [{ surface_xpath: "/t:TEI[1]/t:surface[1]", canvas_id: canvas }],
    });
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(result.w!.tei_links![0].state).toBe("unresolved");
    expect(result.w!.tei_links![1].state).toBe("unresolved");
    expect(result.w!.tei_links!.every((l) => l.target === null)).toBe(true);
  }, 60000);
  it("resolves decimal zones on surface edges while holding truly outside zones", async () => {
    const result = await run(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><surface xml:id="s" sameAs="${canvas}" ulx="0.1" uly="0.1" lrx="0.8" lry="0.8"><zone xml:id="edge" ulx="0.7" uly="0.7" lrx="0.8" lry="0.8"/><zone xml:id="outside" ulx="0.7" uly="0.7" lrx="0.8000001" lry="0.8"/></surface><p facs="#edge"/><p facs="#outside"/></TEI>`);
    expect(result.code, result.stderr + result.stdout).toBe(0);
    const [edge, outside] = result.w!.tei_links!;
    expect(edge.state).toBe("resolved");
    const [x, y, width, height] = edge.target!.xywh!;
    expect(x).toBeCloseTo(6000 / 7);
    expect(y).toBeCloseTo(12000 / 7);
    expect(x + width).toBeLessThanOrEqual(1000);
    expect(y + height).toBeLessThanOrEqual(2000);
    expect(outside.state).toBe("unresolved");
    expect(outside.diagnostics).toContain("zone_outside_surface");
  }, 60000);
  it("rejects changed XML bytes before writing output", async () => {
    const result = await run('<TEI xmlns="http://www.tei-c.org/ns/1.0"><p/></TEI>', { expected_sha256: "0".repeat(64) });
    expect(result.code).toBe(4);
    expect(result.stdout).toContain("hash_mismatch");
    expect(result.w).toBeNull();
  }, 60000);
});
