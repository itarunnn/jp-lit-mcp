import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { ocrCandidate } from "./fixtures/iiif/ocr.js";
import { makeBookRun } from "./fixtures/iiif/bookRun.js";
import { exportEvidence } from "../src/iiif/evidence.js";
import { saveWorkspace } from "../src/iiif/workspace.js";

type ScopeCase = "matching" | "other_region" | "changed_region" | "deleted_region";
function selectRegion(workspace: any, scenario: ScopeCase) {
  const original = workspace.regions[0];
  if (scenario === "matching") return original;
  if (scenario === "changed_region") {
    original.selection.xywh[0]++;
    return original;
  }
  const other = structuredClone(original);
  other.selection.region_id = "r2";
  other.selection.xywh = [650, 1200, 200, 200];
  workspace.regions.push(other);
  if (scenario === "deleted_region") workspace.regions.shift();
  return other;
}

class Element {
  children: Element[] = [];
  textContent = "";
  value = "";
  type = "";
  name = "";
  onclick?: () => void;
  constructor(public tag: string) {}
  append(...children: Element[]) { this.children.push(...children); }
  prepend(child: Element) { this.children.unshift(child); }
  replaceChildren(...children: Element[]) { this.children = children; }
}
function find(root: Element, predicate: (element: Element) => boolean): Element | undefined {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

describe("local OCR text stays within its current source region", () => {
  // 出典検査の欠落による、別領域・旧領域の本文混入を検出する。
  for (const scenario of ["matching", "other_region", "changed_region", "deleted_region"] as const) {
    it(`associates text through the real region button: ${scenario}`, async () => {
      const workspace: any = sampleWorkspace();
      workspace.texts.push(ocrCandidate(), {
        text_id: "provider-page", canvas_id: "https://example.org/c1", text: "頁の既存本文",
        target_xywh: null, source_ref: "https://example.org/annotations", source_sha256: "f".repeat(64),
        origin: "provider_annotation", verification_state: "provider_text",
      });
      const selected = selectRegion(workspace, scenario);
      const source = (await readFile("packages/iiif-workbench/web/app.mjs", "utf8")).replace(/\r\n/g, "\n");
      const render = source.slice(source.indexOf("function renderRegions()"), source.indexOf("function renderTexts()"));
      const state = await import(pathToFileURL(path.resolve("src/iiif/ocr-state.mjs")).href);
      const regions = new Element("section"), count = new Element("span");
      const node = (tag: string, text?: string) => Object.assign(new Element(tag), { textContent: text ?? "" });
      const run = new Function("deps", `const {workspace,node,$,status,ocrMatchesRegion}=deps;
        const ocrPanel=null,manualOcrPanel=null,readingPanel=null,imageComparisonPanel=null;
        ${render}
        renderRegions();`);
      run({ workspace, node, $: (id: string) => id === "regions" ? regions : count, status: () => {}, ...state });
      const article = regions.children[workspace.regions.indexOf(selected)];
      find(article, element => element.tag === "button" && element.textContent === "テキストを関連付ける")!.onclick!();
      expect(selected.text_evidence_ids).toEqual(scenario === "matching" ? ["ocr-1", "provider-page"] : ["provider-page"]);
    });

    it(`exports only local OCR for the selected current source: ${scenario}`, async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "ocr-evidence-scope-"));
      try {
        const fixture = await makeBookRun(dir);
        const selected = selectRegion(fixture.workspace, scenario);
        // 保存・取込済みの関連付けもexport時に再検査する。
        selected.text_evidence_ids = [fixture.textId];
        await saveWorkspace(fixture.workspacePath, fixture.workspace, true);
        const result = await exportEvidence({
          api_version: "0.1", operation: "export_evidence", workspace_path: fixture.workspacePath,
          region_ids: [selected.selection.region_id], output_dir: path.join(dir, "export"),
          overwrite: false, image_permission_confirmed: false,
        });
        const evidence = JSON.parse(await readFile(result.evidence_json_path, "utf8"));
        const text = await readFile(result.text_paths[0], "utf8");
        if (scenario === "matching") {
          expect(evidence.items[0].text_evidence.map((item: any) => item.text_id)).toEqual([fixture.textId]);
          expect(text).toContain("圖一　花の圖\n本文。圖一を見よ。");
        } else {
          expect(evidence.items[0].text_evidence).toEqual([]);
          expect(text).toBe("");
          expect(evidence.diagnostics.some((message: string) => message.includes(fixture.textId))).toBe(true);
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
});
