import { bindTeiLink, recordTeiCollation, teiLinksForRegion, formatTei } from "./tei-state.mjs";

export function createTeiPanel({ element, workspace, current, openImage, selectedRegions, status }) {
  const node = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
  let regionFilter = null, page = 0;
  const drafts=new Map();
  const heading = node("h2", "TEI本文と画像"), description = node("p", "本文の構造を保って画像と往復します。対応付けと本文の校合を別々に記録します。");
  description.className = "hint";
  const filterLabel = node("label", "表示範囲"), filter = node("select");
  for (const [v, label] of [["all", "全ての対応・未解決参照"], ["page", "表示中のページ"], ["region", "選択した領域"]]) { const o = node("option", label); o.value = v; filter.append(o); }
  filterLabel.append(filter);
  const authorLabel = node("label", "記録者"), author = node("input"); author.placeholder = "校合・対応付けの実行者"; author.maxLength = 1024; authorLabel.append(author);
  const list = node("div"); list.id = "tei-links";
  element.replaceChildren(heading, description, filterLabel, authorLabel, list);
  const attempt = (fn) => { try { fn(); render(); status("記録を追加しました。作業を保存してください。"); } catch (e) { status(e.message); } };
  function render() {
    list.replaceChildren();
    const w = workspace(), all = w.tei_links ?? [];
    let links = all;
    if (filter.value === "page") { const { d, c } = current(); links = all.filter((l) => l.document_id === d?.document_id && l.target?.canvas_id === c?.canvas_id); }
    if (filter.value === "region") {
      const ids = regionFilter ? [regionFilter] : selectedRegions();
      links = [...new Map(w.regions.filter((r) => ids.includes(r.selection.region_id)).flatMap((r) => teiLinksForRegion(w, r)).map((l) => [l.link_id, l])).values()];
    }
    page = Math.min(page, Math.max(0, Math.ceil(links.length / 100) - 1));
    const start = page * 100, end = Math.min(start + 100, links.length);
    list.append(node("p", `${links.length}件${links.length ? `（${start + 1}〜${end}件を表示）` : ""}`));
    if (links.length > 100) {
      const navigation = node("nav"); navigation.setAttribute("aria-label", "TEI対応のページ送り");
      const previous = node("button", "前の100件"), next = node("button", "次の100件");
      previous.disabled = page === 0; next.disabled = end === links.length;
      previous.onclick = () => { page--; render(); };
      next.onclick = () => { page++; render(); };
      navigation.append(previous, next); list.append(navigation);
    }
    if (!all.length) list.append(node("p", "TEIをCLIのlink_teiで結び付け、作業JSONを読み込むと本文が表示されます。"));
    for (const link of links.slice(start, end)) {
      const key=JSON.stringify([w.workspace_id,link.link_id,link.reference.source_locator.document_sha256]);
      const draft=drafts.get(key)??{note:"",outcome:"uncertain",open:false};drafts.set(key,draft);
      const article = node("article"); article.className = "tei-link"; article.dataset.linkId = link.link_id;
      const title = node("h3", link.reference.source_locator.xml_id || link.reference.source_locator.xpath);
      const states = { resolved: "対応あり", candidate: "候補", unresolved: "未解決" };
      article.append(title, node("p", `${states[link.state]} · ${link.reference.raw_token}`));
      const content = node("pre", link.reference.source_content ? formatTei(link.reference.source_content) : "本文単位が上限を超えています。TEI readerで小さい単位を指定してください。");
      content.className = "tei-content"; article.append(content);
      const go = node("button", "対応する画像へ"); go.disabled = !link.target;
      go.onclick = () => { try { openImage(link); } catch (e) { status(e.message); } }; article.append(go);
      const details = node("details"), summary = node("summary", "対応付け・校合と出典"); details.append(summary);
      details.open=draft.open;details.ontoggle=()=>{draft.open=details.open;};
      const noteLabel = node("label", "確認内容・対応の理由"), note = node("textarea"); note.rows = 2; note.maxLength = 20000; noteLabel.append(note); details.append(noteLabel);
      note.value=draft.note;note.oninput=()=>{draft.note=note.value;};
      const bind = node("button", "選択した1領域に結び付ける");
      bind.onclick = () => attempt(() => { const ids = selectedRegions(); if (ids.length !== 1) throw new Error("領域コレクションから1領域を選んでください"); bindTeiLink(w, link.link_id, ids[0], author.value, note.value);drafts.delete(key); }); details.append(bind);
      const outcomeLabel = node("label", "本文の校合結果"), outcome = node("select");
      for (const [value, text] of [["uncertain", "判断保留"], ["match", "一致を確認"], ["mismatch", "相違あり"]]) { const o = node("option", text); o.value = value; outcome.append(o); } outcomeLabel.append(outcome); details.append(outcomeLabel);
      outcome.value=draft.outcome;outcome.onchange=()=>{draft.outcome=outcome.value;};
      const collate = node("button", "原画像との校合を記録"); collate.disabled = !link.target;
      collate.onclick = () => attempt(() => {recordTeiCollation(w, link.link_id, author.value, outcome.value, note.value);drafts.delete(key);}); details.append(collate);
      details.append(node("p", `対応記録${link.assignments.length}件 / 校合記録${link.collations.length}件`));
      details.append(node("pre", JSON.stringify({ file_path: link.file_path, source_locator: link.reference.source_locator, target: link.target, candidates: link.candidates,
        diagnostics: link.diagnostics, assignments: link.assignments, collations: link.collations, reference: { target: link.reference.target, surface: link.reference.surface, graphics: link.reference.graphics, xml_base_chain: link.reference.xml_base_chain } }, null, 2)));
      article.append(details); list.append(article);
    }
  }
  filter.onchange = () => { regionFilter = null; page = 0; render(); };
  return { render, showRegion(region) { regionFilter = region.selection.region_id; filter.value = "region"; page = 0; render(); element.scrollIntoView({ block: "start", behavior: "smooth" }); } };
}
