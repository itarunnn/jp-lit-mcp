// TEIの原構造、画像対応、本文校合を別々に保持する。
export function teiLinksForRegion(workspace, region) {
  const doc = workspace.windows.find((w) => w.window_id === region.selection.window_id)?.document_id;
  const [x, y, w, h] = region.selection.xywh;
  return (workspace.tei_links ?? []).filter((link) => {
    const t = link.target;
    if (link.state !== "resolved" || link.document_id !== doc || t?.canvas_id !== region.selection.canvas_id) return false;
    if (!t.xywh) return true;
    const [tx, ty, tw, th] = t.xywh;
    return x < tx + tw && tx < x + w && y < ty + th && ty < y + h;
  });
}
function attributed(recorded_by, note) {
  if (typeof recorded_by !== "string" || !recorded_by.trim() || typeof note !== "string" || !note.trim()) throw new Error("記録者と確認内容を入力してください");
  return { recorded_at: new Date().toISOString(), recorded_by: recorded_by.trim(), note: note.trim() };
}
export function bindTeiLink(workspace, linkId, regionId, recordedBy, note) {
  const link = workspace.tei_links?.find((l) => l.link_id === linkId), region = workspace.regions.find((r) => r.selection.region_id === regionId);
  if (!link || !region || workspace.windows.find((w) => w.window_id === region.selection.window_id)?.document_id !== link.document_id) throw new Error("同じ資料の領域を1件選んでください");
  const attribution = attributed(recordedBy, note);
  if (link.assignments.length >= 100) throw new Error("対応記録の上限です");
  link.target = { canvas_id: region.selection.canvas_id, xywh: [...region.selection.xywh], region_id: regionId, basis: "manual_region" };
  link.state = "resolved";
  link.assignments.push({ ...attribution, target: structuredClone(link.target) });
}
export function recordTeiCollation(workspace, linkId, recordedBy, result, note) {
  const link = workspace.tei_links?.find((l) => l.link_id === linkId);
  if (link?.state !== "resolved" || !link.target) throw new Error("画像領域との対応を先に指定してください");
  if (!["match", "mismatch", "uncertain"].includes(result)) throw new Error("校合結果を指定してください");
  if (link.collations.length >= 100) throw new Error("校合記録の上限です");
  link.collations.push({ ...attributed(recordedBy, note), result, target: structuredClone(link.target) });
}
export function detachTeiRegion(workspace, regionId) {
  for (const link of workspace.tei_links ?? [])
    if (link.target?.region_id === regionId) link.target.region_id = null;
}
export function formatTei(root) {
  const escape = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const name = (s) => s.startsWith("{http://www.tei-c.org/ns/1.0}") ? "tei:" + s.slice("{http://www.tei-c.org/ns/1.0}".length) : s.startsWith("{http://www.w3.org/XML/1998/namespace}") ? "xml:" + s.slice("{http://www.w3.org/XML/1998/namespace}".length) : s;
  const out = [], stack = [{ node: root, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { node: n, close, depth } = stack.pop();
    if (close) { out.push(`</${close}>`); continue; }
    if (++count > 4000 || depth > 256) { out.push("[表示上限]"); break; }
    if (n?.kind === "element" && typeof n.name === "string" && Array.isArray(n.content)) {
      const tag = name(n.name);
      const attrs = Object.entries(n.attributes ?? {}).map(([k, v]) => ` ${name(k)}="${escape(v)}"`).join("");
      out.push(`<${tag}${attrs}>`);
      stack.push({ close: tag });
      for (let i = n.content.length - 1; i >= 0; i--) stack.push({ node: n.content[i], depth: depth + 1 });
    } else if (n?.kind === "text") out.push(escape(n.value));
    else if (n?.kind === "comment") out.push(`<!--${escape(n.value)}-->`);
    else if (n?.kind === "pi") out.push(`<?${escape(n.target)} ${escape(n.value)}?>`);
  }
  return out.join("");
}
