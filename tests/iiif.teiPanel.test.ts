import { describe, it, expect, vi } from "vitest";
// @ts-expect-error ブラウザと共有するJS module
import { bindTeiLink, recordTeiCollation, teiLinksForRegion, detachTeiRegion, formatTei } from "../src/iiif/tei-state.mjs";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { linkTei } from "../src/iiif/tei.js";
import { validateWorkspace } from "../src/iiif/schemas.js";
import { mkdtemp, readFile, rm, copyFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { exportEvidence } from "../src/iiif/evidence.js";
const hash = "a".repeat(64);
function workspace() {
  const w = sampleWorkspace();
  const loc = { document_sha256: hash, xpath: "/t:TEI[1]/t:p[1]", xml_id: "p1" };
  return linkTei(validateWorkspace(w), {
    api_version: "0.1", operation: "facsimile_links", ok: true, document: { sha256: hash },
    result: { total_occurrences: 1, next_offset: null, items: [{
      source_locator: loc, source_content: { kind: "element", name: "{http://www.tei-c.org/ns/1.0}p", attributes: { facs: "#missing" }, locator: loc,
        content: [{ kind: "text", value: "本文<script>" }] }, omission: null, attribute_value: "#missing", token_index: 0, raw_token: "#missing",
      reference_status: "unresolved_local", candidate_count: 0, xml_base_chain: [], target: null, surface: null, graphics: [], diagnostics: [],
    }] },
  }, { file_path: "J:/research/source.xml", expected_sha256: hash, document_id: "d1", surface_bindings: [] });
}
describe("TEI correspondence and collation", () => {
  it("reaches and records an unresolved reference after the first 100 entries", async () => {
    class Element {
      children: Element[] = [];
      textContent = ""; value = ""; disabled = false; dataset: Record<string, string> = {};
      onclick?: () => void;
      constructor(public tag: string) {}
      append(...children: Element[]) { this.children.push(...children); }
      replaceChildren(...children: Element[]) { this.children = children; }
      scrollIntoView() {}
      setAttribute() {}
    }
    const w = workspace(), template = w.tei_links![0];
    w.tei_links = Array.from({ length: 101 }, (_, i) => ({ ...structuredClone(template), link_id: `tei-${i}` }));
    const element = new Element("div"), messages: string[] = [];
    const find = (root: Element, predicate: (e: Element) => boolean): Element | undefined => {
      if (predicate(root)) return root;
      for (const child of root.children) { const found = find(child, predicate); if (found) return found; }
    };
    // 配布時と同じ隣接module配置で、sourceのpanelそのものを実行する。
    const dir = await mkdtemp(path.join(tmpdir(), "tei-panel-"));
    try {
      await Promise.all([
        copyFile(new URL("../packages/iiif-workbench/web/tei-panel.mjs", import.meta.url), path.join(dir, "tei-panel.mjs")),
        copyFile(new URL("../src/iiif/tei-state.mjs", import.meta.url), path.join(dir, "tei-state.mjs")),
      ]);
      const { createTeiPanel } = await import(/* @vite-ignore */ pathToFileURL(path.join(dir, "tei-panel.mjs")).href);
      vi.stubGlobal("document", { createElement: (tag: string) => new Element(tag) });
      const panel = createTeiPanel({ element, workspace: () => w, current: () => ({}), openImage: () => {}, selectedRegions: () => ["r1"], status: (s: string) => messages.push(s) });
      panel.render();
      const author = find(element, (e) => e.tag === "input")!;
      author.value = "review-test";
      const next = find(element, (e) => e.tag === "button" && e.textContent === "次の100件")!;
      expect(next, "後半の未解決参照へ到達する操作が必要").toBeDefined();
      next.onclick!();
      let last = find(element, (e) => e.dataset.linkId === "tei-100")!;
      expect(last).toBeDefined();
      find(last, (e) => e.tag === "textarea")!.value = "合成参照の対応確認";
      find(last, (e) => e.tag === "button" && e.textContent === "選択した1領域に結び付ける")!.onclick!();
      last = find(element, (e) => e.dataset.linkId === "tei-100")!;
      find(last, (e) => e.tag === "textarea")!.value = "合成fixtureの判断保留";
      find(last, (e) => e.tag === "select")!.value = "uncertain";
      find(last, (e) => e.tag === "button" && e.textContent === "原画像との校合を記録")!.onclick!();
      expect(w.tei_links[100].assignments).toHaveLength(1);
      expect(w.tei_links[100].collations[0].result).toBe("uncertain");
      expect(messages).toHaveLength(2);
      find(element, (e) => e.tag === "button" && e.textContent === "前の100件")!.onclick!();
      expect(find(element, (e) => e.dataset.linkId === "tei-0")).toBeDefined();
    } finally { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); }
  });
  it("applies a later explicit surface binding while preserving attributed manual records", () => {
    const w = workspace(), base = w.tei_links![0], reference = structuredClone(base.reference);
    reference.raw_token = "#s"; reference.reference_status = "resolved_local";
    reference.target = reference.surface = { locator: { ...reference.source_locator, xpath: "/t:TEI[1]/t:surface[1]", xml_id: "s" }, name: "{http://www.tei-c.org/ns/1.0}surface", attributes: {}, xml_base_chain: [] };
    const response = { api_version: "0.1", operation: "facsimile_links", ok: true, document: { sha256: hash }, result: { items: [reference], total_occurrences: 1, next_offset: null } };
    const options = { file_path: base.file_path, expected_sha256: hash, document_id: "d1", surface_bindings: [] as {surface_xpath: string; canvas_id: string}[] };
    const initial = linkTei(validateWorkspace(sampleWorkspace()), response, options);
    const next = linkTei(initial, response, { ...options, surface_bindings: [{ surface_xpath: "/t:TEI[1]/t:surface[1]", canvas_id: "https://example.org/c1" }] });
    expect(next.tei_links![0].state).toBe("resolved");
    bindTeiLink(next, next.tei_links![0].link_id, "r1", "reader", "手動の矩形指定");
    recordTeiCollation(next, next.tei_links![0].link_id, "reader", "uncertain", "原画像の疑義");
    const repeated = linkTei(next, response, options);
    expect(repeated.tei_links).toHaveLength(1);
    expect(repeated.tei_links![0].target?.basis).toBe("manual_region");
    expect(repeated.tei_links![0].collations).toHaveLength(1);
  });
  it("exports original TEI structures separately from transcription and records the overlap scope", async () => {
    const w = workspace(), link = w.tei_links![0];
    bindTeiLink(w, link.link_id, "r1", "reader", "明示的な対応");
    recordTeiCollation(w, link.link_id, "reader", "uncertain", "字形を再確認");
    const dir = await mkdtemp(path.join(tmpdir(), "tei-evidence-"));
    try {
      const file = path.join(dir, "workspace.json");
      await saveWorkspace(file, w, false);
      const result = await exportEvidence({ api_version: "0.1", operation: "export_evidence", workspace_path: file, region_ids: ["r1"], output_dir: path.join(dir, "evidence"), overwrite: false, image_permission_confirmed: false });
      const evidence = JSON.parse(await readFile(result.evidence_json_path, "utf8"));
      expect(evidence.items[0].tei_evidence[0].reference.source_locator.document_sha256).toBe(hash);
      expect(evidence.items[0].tei_scope).toBe("overlap_context");
      const original = JSON.parse(await readFile(result.tei_paths[0], "utf8"));
      expect(original[0].reference.source_content.content[0].value).toBe("本文<script>");
      expect(await readFile(result.text_paths[0], "utf8")).toBe("");
      expect(result.image_paths).toEqual([]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("requires an attributed manual assignment and links only overlapping regions", () => {
    const w = workspace(), link = w.tei_links![0];
    expect(() => bindTeiLink(w, link.link_id, "r1", "", "reason")).toThrow();
    expect(() => bindTeiLink(w, link.link_id, "r1", "reader", "")).toThrow();
    bindTeiLink(w, link.link_id, "r1", "reader", "画像と本文を確認");
    expect(link.state).toBe("resolved");
    expect(link.target?.xywh).toEqual([100, 200, 300, 400]);
    expect(link.assignments).toHaveLength(1);
    expect(link.collations).toEqual([]);
    expect(teiLinksForRegion(w, w.regions[0])).toHaveLength(1);
    const far = structuredClone(w.regions[0]); far.selection.xywh = [600, 800, 10, 10];
    expect(teiLinksForRegion(w, far)).toEqual([]);
    link.state = "candidate"; link.target = null;
    expect(teiLinksForRegion(w, w.regions[0])).toEqual([]);
  });
  it("pins each collation to its target even after reassignment or region removal", () => {
    const w = workspace(), link = w.tei_links![0];
    expect(() => recordTeiCollation(w, link.link_id, "reader", "match", "確認")).toThrow();
    bindTeiLink(w, link.link_id, "r1", "reader", "確認");
    recordTeiCollation(w, link.link_id, "reader", "uncertain", "細字が判読困難");
    w.regions.push({ ...structuredClone(w.regions[0]), selection: { ...w.regions[0].selection, region_id: "r2", xywh: [500, 800, 100, 100] } });
    bindTeiLink(w, link.link_id, "r2", "reader", "別の領域を確認");
    expect(link.collations[0].target.xywh).toEqual([100, 200, 300, 400]);
    expect(link.collations[0].result).toBe("uncertain");
    detachTeiRegion(w, "r2");
    w.regions = w.regions.filter((r) => r.selection.region_id !== "r2");
    expect(link.target?.region_id).toBeNull();
    expect(validateWorkspace(w).tei_links![0].assignments).toHaveLength(2);
    expect(link.reference.raw_token).toBe("#missing");
  });
  it("shows both alternative readings and treats embedded markup as text", () => {
    const s = formatTei({ kind: "element", name: "{http://www.tei-c.org/ns/1.0}choice", attributes: {}, content: [
      { kind: "element", name: "{http://www.tei-c.org/ns/1.0}orig", attributes: {}, content: [{ kind: "text", value: "舊<script>" }] },
      { kind: "element", name: "{http://www.tei-c.org/ns/1.0}reg", attributes: {}, content: [{ kind: "text", value: "旧" }] },
    ] });
    expect(s).toContain("<tei:orig>舊&lt;script&gt;</tei:orig>");
    expect(s).toContain("<tei:reg>旧</tei:reg>");
    expect(s).not.toContain("<script>");
  });
});
