import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { facsimileResponseSchema, type TeiLink } from "./teiSchemas.js";
import { validateWorkspace } from "./schemas.js";
import type { IiifWorkspace, CanvasInfo } from "./types.js";

// Python環境を使うのは利用者がlink_teiを要求した場合だけ。
export async function readTeiLinks(file: string, hash: string, limit: number, offset: number): Promise<unknown> {
  const parent = fileURLToPath(new URL("../../", import.meta.url));
  const root = path.basename(path.normalize(parent)) === "dist" ? path.dirname(path.normalize(parent)) : parent;
  const launcher = path.join(root, "scripts/tei-reader.mjs");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [launcher, "--request", "-"], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0, stderr = false, settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error("TEI readerの処理時間が上限を超えました")), 60000);
    child.on("error", () => fail(new Error("TEI readerを起動できません")));
    child.stdin.on("error", () => fail(new Error("TEI readerへ要求を渡せません")));
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1024 * 1024) fail(new Error("TEI readerの応答容量が上限を超えました"));
      else chunks.push(chunk);
    });
    child.stderr.on("data", () => { stderr = true; });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (stderr || code !== 0 || !result.ok) throw new Error(`TEI reader: ${result.error?.code ?? "runtime_launch_failed"}`);
        resolve(result);
      } catch (error) { reject(error instanceof Error ? error : new Error("TEI readerの応答が不正です")); }
    });
    child.stdin.end(JSON.stringify({ operation: "facsimile_links", file_path: file, expected_sha256: hash, limit, offset }));
  });
}

type Options = { file_path: string; expected_sha256: string; document_id: string; surface_bindings: { surface_xpath: string; canvas_id: string }[] };
function inside(rect: [number, number, number, number], c: CanvasInfo) {
  return rect.every(Number.isFinite) && rect[0] >= 0 && rect[1] >= 0 && rect[2] > 0 && rect[3] > 0 && rect[0] + rect[2] <= c.width && rect[1] + rect[3] <= c.height;
}
function bounds(a: Record<string, string>): [number, number, number, number] | null {
  const keys = ["ulx", "uly", "lrx", "lry"];
  if (keys.some((k) => !a[k]?.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(a[k]))) return null;
  const [x, y, right, bottom] = keys.map((k) => Number(a[k]));
  return [x, y, right, bottom].every(Number.isFinite) && right > x && bottom > y ? [x, y, right, bottom] : null;
}
function geometryUnsupported(a: Record<string, string>) {
  return ["points", "ulz", "lrz"].some((k) => k in a) || ("rotate" in a && (!Number.isFinite(Number(a.rotate)) || Number(a.rotate) !== 0));
}

export function linkTei(workspace: IiifWorkspace, input: unknown, options: Options): IiifWorkspace {
  const response = facsimileResponseSchema.parse(input);
  if (response.document.sha256 !== options.expected_sha256) throw new Error("XML hashが一致しません");
  const doc = workspace.documents.find((d) => d.document_id === options.document_id);
  if (!doc) throw new Error("TEI対応先のdocumentが見つかりません");
  const bindings = new Map<string, string>();
  for (const b of options.surface_bindings) {
    if (bindings.has(b.surface_xpath) || !doc.canvases.some((c) => c.canvas_id === b.canvas_id)) throw new Error("surface対応が重複または未解決です");
    bindings.set(b.surface_xpath, b.canvas_id);
  }
  const links = new Map((workspace.tei_links ?? []).map((l) => [l.link_id, l]));
  for (const ref of response.result.items) {
    if (ref.source_locator.document_sha256 !== response.document.sha256) throw new Error("TEI locatorのhashが一致しません");
    const link_id = "tei-" + createHash("sha256").update(JSON.stringify([response.document.sha256, ref.source_locator.xpath, ref.token_index, options.document_id])).digest("hex");
    // 実行者の記録を保全し、未記録の対応には後から明示bindingを適用できる。
    const existing = links.get(link_id);
    if (existing && (existing.assignments.length || existing.collations.length)) continue;
    const link: TeiLink = { link_id, document_id: doc.document_id, file_path: options.file_path,
      imported_at: existing?.imported_at ?? new Date().toISOString(), reference: ref, state: "unresolved", target: null,
      candidates: [], diagnostics: [...ref.diagnostics], assignments: [], collations: [] };
    const based = ref.xml_base_chain.some((b) => b.value.length > 0);
    if (based) link.diagnostics.push("xml_base_requires_review");
    else {
      const match = /^(.*?)(?:#xywh=(?:pixel:)?(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?))?$/.exec(ref.raw_token);
      const direct = match && doc.canvases.find((c) => c.canvas_id === match[1]);
      if (direct) {
        const rect = match![2] === undefined ? null : match!.slice(2).map(Number) as [number, number, number, number];
        if (!rect || inside(rect, direct)) link.target = { canvas_id: direct.canvas_id, xywh: rect, region_id: null, basis: "direct_canvas" };
        else link.diagnostics.push("canvas_rectangle_out_of_bounds");
      } else if (ref.reference_status === "resolved_local" && ref.surface) {
        const surface = ref.surface, target = ref.target!;
        const binding = bindings.get(surface.locator.xpath);
        const declared = surface.attributes.sameAs;
        const bound = binding ?? declared;
        const basis = binding ? "surface_binding" : "surface_same_as";
        if (binding && declared && binding !== declared) link.diagnostics.push("surface_binding_overrides_same_as");
        const canvas = doc.canvases.find((c) => c.canvas_id === bound);
        const baseContext = [...surface.xml_base_chain, ...target.xml_base_chain].some((b) => b.value.length > 0);
        if (baseContext || ref.diagnostics.includes("nested_geometry") || geometryUnsupported(surface.attributes) || geometryUnsupported(target.attributes)) {
          link.diagnostics.push("unsupported_surface_geometry_or_base");
        } else if (canvas) {
          if (target.name === "{http://www.tei-c.org/ns/1.0}surface") link.target = { canvas_id: canvas.canvas_id, xywh: null, region_id: null, basis };
          else if (target.name === "{http://www.tei-c.org/ns/1.0}zone") {
            const s = bounds(surface.attributes), t = bounds(target.attributes);
            if (s && t) {
              // 原座標で包含を確かめ、境界点を変換してからxywhへ戻す。
              // 包含済みの点だけをCanvas内に補正し、外側のzoneを丸めて採用しない。
              if (t[0] < s[0] || t[1] < s[1] || t[2] > s[2] || t[3] > s[3]) link.diagnostics.push("zone_outside_surface");
              else {
                const map = (value: number, lo: number, hi: number, size: number) => Math.max(0, Math.min(size, (value - lo) / (hi - lo) * size));
                const x = map(t[0], s[0], s[2], canvas.width), y = map(t[1], s[1], s[3], canvas.height);
                const right = map(t[2], s[0], s[2], canvas.width), bottom = map(t[3], s[1], s[3], canvas.height);
                const rect: [number, number, number, number] = [x, y, Math.min(right - x, canvas.width - x), Math.min(bottom - y, canvas.height - y)];
                if (inside(rect, canvas)) link.target = { canvas_id: canvas.canvas_id, xywh: rect, region_id: null, basis };
                else link.diagnostics.push("zone_outside_surface");
              }
            } else link.diagnostics.push("surface_or_zone_coordinates_missing");
          } else link.diagnostics.push("graphic_extent_requires_review");
        }
      }
      if (!link.target && !link.diagnostics.includes("unsupported_surface_geometry_or_base")) {
        const urls = ref.reference_status === "resolved_local" ? ref.graphics.filter((g) => !g.xml_base_chain.some((b) => b.value)).map((g) => g.attributes.url) : [ref.raw_token];
        link.candidates = doc.canvases.filter((c) => c.images.some((im) => urls.includes(im.image_id))).map((c) => ({ canvas_id: c.canvas_id, basis: "image_url_match" }));
      }
    }
    link.state = link.target ? "resolved" : link.candidates.length ? "candidate" : "unresolved";
    links.set(link_id, link);
  }
  return validateWorkspace({ ...workspace, tei_links: [...links.values()] });
}
