import { assertOcrTarget, recordOcrReview } from "./ocr-state.mjs";

export function createOcrPanel({ element, workspace, current, openImage, status }) {
  const node = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
  let page = 0, regionId = null;
  const authorLabel = node("label", "記録者"), author = node("input");
  author.placeholder = "校合の記録者"; author.maxLength = 1024; authorLabel.append(author);
  const filterLabel = node("label", "表示範囲"), filter = node("select");
  for (const [value, text] of [["all", "全てのOCR候補"], ["page", "表示中のページ"], ["region", "選択した領域"]]) { const o = node("option", text); o.value = value; filter.append(o); }
  filter.value = "all"; filterLabel.append(filter);
  const list = node("div"); list.id = "ocr-candidates";
  const hint = node("p", "OCRの原文を画像と校合します。修訂候補と確認記録を追加し、原文とTEIを保持します。"); hint.className = "hint";
  element.replaceChildren(node("h2", "くずし字OCRと画像校合"), hint, filterLabel, authorLabel, list);
  const attempt = (fn) => { try { fn(); } catch (e) { status(e.message); } };
  function render() {
    list.replaceChildren();
    const w = workspace();
    let texts = w.texts.filter((t) => t.ocr_provenance);
    if (filter.value === "page") { const { d, c } = current(); texts = texts.filter((t) => t.ocr_provenance.source.document_id === d?.document_id && t.canvas_id === c?.canvas_id); }
    if (filter.value === "region") texts = texts.filter((t) => t.ocr_provenance.source.evidence_id === regionId);
    page = Math.min(page, Math.max(0, Math.ceil(texts.length/20)-1));
    const start = page*20, end = Math.min(start+20,texts.length);
    list.append(node("p", `${texts.length}件${texts.length ? `（${start+1}〜${end}件を表示）` : ""}`));
    if (texts.length > 20) {
      const nav = node("nav"); nav.setAttribute("aria-label", "OCR候補のページ送り");
      const previous = node("button", "前の20件"), next = node("button", "次の20件");
      previous.disabled = page === 0; next.disabled = end === texts.length;
      previous.onclick = () => { page--; render(); }; next.onclick = () => { page++; render(); }; nav.append(previous,next);list.append(nav);
    }
    if (!texts.length) list.append(node("p", "OCR候補を含む作業JSONを読み込むと、本文・出典・校合記録が表示されます。"));
    for (const t of texts.slice(start,end)) {
      const p = t.ocr_provenance, article = node("article"); article.className = "tei-link"; article.dataset.textId = t.text_id;
      let targetError = null; try { assertOcrTarget(w,t); } catch (e) { targetError = e.message; }
      article.append(node("h3", `OCR候補 · ${p.source.evidence_id}`), node("p", `翻刻候補の原出力 · ${p.lines.length}行 · ${(p.duration_ms/1000).toFixed(1)}秒`));
      const original = node("pre", t.text); original.className = "tei-content"; article.append(original);
      if (targetError) article.append(node("p", targetError));
      const whole = node("button", "原画像の領域へ"); whole.disabled = !!targetError;
      whole.onclick = () => attempt(() => openImage(t,null)); article.append(whole);
      if (p.lines.length) {
        const lineLabel = node("label", `行番号（1〜${p.lines.length}）`), index = node("input");
        index.type = "number"; index.min = "1"; index.max = String(p.lines.length); index.value = "1"; lineLabel.append(index);
        const preview = node("p"), go = node("button", "この行の画像へ"); go.disabled = !!targetError;
        function selectedLine() { const n = Number(index.value); if (!Number.isInteger(n) || n < 1 || n > p.lines.length) throw new Error("有効な行番号を入力してください"); return p.lines[n-1]; }
        index.onchange = () => attempt(() => { const l = selectedLine(); preview.textContent = `${l.text} / Canvas ${l.canvas_xywh.join(", ")} / 領域検出の信頼度 ${l.detection_confidence ?? "記録なし"}`; });
        index.onchange(); go.onclick = () => attempt(() => openImage(t,selectedLine())); article.append(lineLabel,preview,go);
      }
      const details = node("details"); details.append(node("summary", `校合記録${p.reviews.length}件と出典`));
      const outcomeLabel = node("label", "校合結果"), outcome = node("select");
      for (const [value,text] of [["uncertain","判断保留"],["match","一致を確認"],["mismatch","相違あり"]]) { const o=node("option",text);o.value=value;outcome.append(o); }
      outcome.value = "uncertain"; outcomeLabel.append(outcome);
      const noteLabel = node("label", "確認内容"), note = node("textarea"); note.rows=2;note.maxLength=20000;note.placeholder="原画像で確認した内容";noteLabel.append(note);
      const correctionLabel = node("label", "修訂候補（任意）"), correction = node("textarea");correction.rows=3;correction.maxLength=2*1024*1024;correction.placeholder="任意の修訂候補";correctionLabel.append(correction);
      const record = node("button", "原画像との校合を記録"); record.disabled = !!targetError;
      record.onclick = () => attempt(() => { recordOcrReview(w,t.text_id,author.value,outcome.value,note.value,correction.value === "" ? null : correction.value);render();status("OCRの校合記録を追加しました。作業を保存してください。"); });
      details.append(outcomeLabel,noteLabel,correctionLabel,record);
      details.append(node("pre", JSON.stringify({ engine:p.engine,source:p.source,run_path:p.run_path,run_sha256:p.run_sha256,
        evidence_path:p.evidence_path,evidence_sha256:p.evidence_sha256,started_at:p.started_at,finished_at:p.finished_at,
        artifacts:p.artifacts,diagnostics:p.diagnostics,reviews:p.reviews },null,2)));
      article.append(details);list.append(article);
    }
  }
  filter.onchange = () => { regionId=null;page=0;render(); };
  return { render, showRegion(region) { regionId=region.selection.region_id;filter.value="region";page=0;render();element.scrollIntoView({block:"start",behavior:"smooth"}); } };
}
