import {
  createViewer,
  readViewerState,
  selectRegion,
  setCanvas,
  showRegion,
} from "./viewer-adapter.mjs";
import { mergeTextResult, addComparisonWindow } from "./workspace-state.mjs";
import { createTeiPanel } from "./tei-panel.mjs";
import { detachTeiRegion } from "./tei-state.mjs";
import { createOcrPanel } from "./ocr-panel.mjs";
import { assertOcrTarget } from "./ocr-state.mjs";
const $ = (id) => document.getElementById(id),
  token = location.hash.slice(1);
let workspace, viewer, pendingRegion, teiPanel, ocrPanel;
const status = (text) => {
  $("status").textContent = text;
};
const selectedRegions = () => [...document.querySelectorAll("input[name=region]:checked")].map((e) => e.value);
async function api(route, body) {
  const r = await fetch(route, {
    method: body === undefined ? "GET" : "POST",
    headers: { "x-iiif-token": token, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data;
}
function action(id, fn) {
  $(id).addEventListener("click", () =>
    Promise.resolve()
      .then(fn)
      .catch((e) => status(e.message)),
  );
}
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function current() {
  const w = workspace.windows.find(
    (w) => w.window_id === $("active-window").value,
  );
  const d = workspace.documents.find((d) => d.document_id === w?.document_id);
  const canvas =
    viewer.viewer.store.getState().windows[w?.window_id]?.canvasId ??
    w?.canvas_id;
  return { w, d, c: d?.canvases.find((c) => c.canvas_id === canvas) };
}
const label = (values) => values.flatMap((v) => v.values).join(" / ");
function snapshot() {
  const state = readViewerState(viewer);
  workspace = { ...workspace, windows: state.windows, viewer_state: state };
  viewer.workspace = workspace;
  return workspace;
}
async function save() {
  snapshot();
  await api("/api/workspace", workspace);
  status("作業を保存しました。");
}
function download(value, name) {
  const a = node("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function setPending(r) {
  pendingRegion = r;
  $("coordinates").textContent =
    `Canvas領域 ${r.xywh.join(", ")} ／ 回転 ${r.rotation_degrees}°`;
  $("add-region").disabled = false;
  ["x", "y", "w", "h"].forEach((id, i) => ($(id).value = r.xywh[i]));
}
function build() {
  viewer?.destroy();
  pendingRegion = null;
  $("add-region").disabled = true;
  const errors = new Set();
  viewer = createViewer($("viewer"), workspace, token, (error) => {
    if (errors.has(error.id)) return;
    errors.add(error.id);
    const message = node(
      "p",
      `画像を取得できませんでした: ${error.id} / ${error.message}`,
    );
    message.setAttribute("role", "status");
    $("viewer-errors").append(message);
  });
  $("viewer-errors").replaceChildren();
  $("window-controls").replaceChildren();
  $("active-window").replaceChildren();
  for (const [index, w] of workspace.windows.entries()) {
    const d = workspace.documents.find((d) => d.document_id === w.document_id);
    const control = node("label", `${index + 1} · ${label(d.label)}`),
      select = node("select");
    select.setAttribute("aria-label", `${index + 1}のページ`);
    for (const c of d.canvases) {
      const option = node(
        "option",
        `${c.canvas_index_1based} · ${label(c.label)}`,
      );
      option.value = c.canvas_id;
      select.append(option);
    }
    select.value = w.canvas_id;
    select.onchange = () => {
      setCanvas(viewer, w.window_id, select.value);
      workspace.windows.find((v) => v.window_id === w.window_id).canvas_id = select.value;
      pendingRegion = null;
      $("add-region").disabled = true;
      renderTexts();
      renderSources();
      teiPanel?.render();
    };
    control.append(select);
    const add = node("button", "別窓で比較");
    add.disabled = workspace.windows.length >= 4;
    add.onclick = () => {
      snapshot();
      addComparisonWindow(workspace, w.window_id, crypto.randomUUID());
      build();
    };
    control.append(add);
    if (workspace.windows.length > 1) {
      const close = node("button", "窓を閉じる");
      close.onclick = () => {
        if (
          workspace.regions.some((r) => r.selection.window_id === w.window_id)
        ) {
          status("この窓の領域を削除してから閉じてください。");
          return;
        }
        snapshot();
        workspace.windows = workspace.windows.filter(
          (v) => v.window_id !== w.window_id,
        );
        workspace.viewer_state.windows = workspace.windows;
        build();
      };
      control.append(close);
    }
    $("window-controls").append(control);
    const option = node("option", `${index + 1} · ${label(d.label)}`);
    option.value = w.window_id;
    $("active-window").append(option);
  }
  const unsubscribe = viewer.viewer.store.subscribe(() => {
    let changed = false;
    for (const [i, w] of workspace.windows.entries()) {
      const canvasId =
        viewer.viewer.store.getState().windows[w.window_id]?.canvasId;
      if (canvasId && canvasId !== w.canvas_id) {
        w.canvas_id = canvasId;
        $("window-controls").querySelectorAll("select")[i].value = canvasId;
        changed = true;
      }
    }
    if (changed) {
      pendingRegion = null;
      $("add-region").disabled = true;
      renderTexts();
      renderSources();
    }
  });
  const destroy = viewer.destroy;
  viewer.destroy = () => {
    unsubscribe();
    destroy();
  };
  renderSources();
  renderRegions();
  renderTexts();
}
function renderSources() {
  $("sources").replaceChildren();
  for (const d of workspace.documents) {
    const article = node("article");
    article.append(
      node("h3", label(d.label)),
      node("p", `${d.candidate.source} / ${d.candidate.source_id}`),
      node(
        "pre",
        JSON.stringify(
          {
            record_url: d.candidate.record_url,
            manifest_url: d.receipt.requested_url,
            final_url: d.receipt.final_url,
            sha256: d.receipt.sha256,
            rights: d.rights,
            page_rights: d.canvases
              .filter((c) =>
                workspace.windows.some(
                  (w) =>
                    w.document_id === d.document_id &&
                    w.canvas_id === c.canvas_id,
                ),
              )
              .map((c) => ({
                canvas_id: c.canvas_id,
                rights: c.rights,
                images: c.images.map((im) => ({
                  image_id: im.image_id,
                  rights: im.rights,
                })),
              })),
            diagnostics: d.diagnostics,
          },
          null,
          2,
        ),
      ),
    );
    $("sources").append(article);
  }
}
function renderRegions() {
  $("region-count").textContent = workspace.regions.length;
  $("regions").replaceChildren();
  for (const r of workspace.regions) {
    const article = node("article", undefined, "region");
    const check = node(
      "label",
      `${r.tags.join(" / ") || "領域"} · ${r.selection.xywh.join(", ")}`,
      "check",
    );
    const input = node("input");
    input.type = "checkbox";
    input.value = r.selection.region_id;
    input.name = "region";
    check.prepend(input);
    article.append(check, node("p", r.selection_reason), node("p", r.note));
    const buttons = node("div", undefined, "actions");
    const back = node("button", "元の場所へ戻る");
    back.onclick = () => {
      showRegion(viewer, r.selection);
      $("active-window").value = r.selection.window_id;
      status(`領域 ${r.selection.region_id} のCanvasへ移動しました。`);
    };
    const link = node("button", "テキストを関連付ける");
    link.onclick = () => {
      r.text_evidence_ids = workspace.texts
        .filter((t) => t.canvas_id === r.selection.canvas_id)
        .map((t) => t.text_id);
      status(`${r.text_evidence_ids.length}件の原テキストを関連付けました。`);
    };
    const tei = node("button", "関連TEI本文");
    tei.onclick = () => teiPanel.showRegion(r);
    const ocr = node("button", "関連OCR候補");
    ocr.onclick = () => ocrPanel.showRegion(r);
    const remove = node("button", "削除");
    remove.onclick = () => {
      detachTeiRegion(workspace, r.selection.region_id);
      workspace.regions = workspace.regions.filter((v) => v !== r);
      renderRegions();
    };
    buttons.append(back, link, tei, ocr, remove);
    article.append(buttons);
    $("regions").append(article);
  }
  ocrPanel?.render();
}
function renderTexts() {
  teiPanel?.render();
  ocrPanel?.render();
  if (!workspace) return;
  const { c } = current();
  $("texts").replaceChildren();
  for (const t of workspace.texts.filter((t) => t.canvas_id === c?.canvas_id && !t.ocr_provenance))
    $("texts").append(
      node("p", `${t.origin} / ${t.verification_state}`),
      node("pre", t.text),
    );
}
action("save", save);
action("download", () => download(snapshot(), "workspace.json"));
action("select-region", async () => {
  $("cancel-region").hidden = false;
  status("画像上をドラッグして矩形を選んでください。Escで取消できます。");
  try {
    setPending(await selectRegion(viewer, $("active-window").value));
  } finally {
    $("cancel-region").hidden = true;
  }
});
action("cancel-region", () => viewer.cancelSelection?.());
action("whole-page", () => {
  const { w, c } = current();
  if (!c) throw new Error("Canvasが読み込まれていません");
  setPending({
    region_id: crypto.randomUUID(),
    window_id: w.window_id,
    canvas_id: c.canvas_id,
    xywh: [0, 0, c.width, c.height],
    coordinate_space: "canvas",
    rotation_degrees: 0,
  });
});
action("manual-region", () => {
  const { w, c } = current();
  const [x, y, width, height] = ["x", "y", "w", "h"].map((id) =>
    Number($(id).value),
  );
  if (
    !c ||
    ![x, y, width, height].every(Number.isFinite) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > c.width ||
    y + height > c.height
  )
    throw new Error("Canvas内の座標を指定してください");
  setPending({
    region_id: crypto.randomUUID(),
    window_id: w.window_id,
    canvas_id: c.canvas_id,
    xywh: [x, y, width, height],
    coordinate_space: "canvas",
    rotation_degrees: 0,
  });
});
action("add-region", () => {
  if (!pendingRegion) throw new Error("領域を選んでください");
  workspace.regions.push({
    selection: pendingRegion,
    mapping_state: "manifest_declared",
    tags: $("tags")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    selection_reason: $("reason").value,
    note: $("note").value,
    text_evidence_ids: [],
  });
  pendingRegion = null;
  $("add-region").disabled = true;
  renderRegions();
  status("領域をコレクションに追加しました。作業を保存できます。");
});
action("annotations", async () => {
  await save();
  download(await api("/api/annotations"), "annotations.json");
});
action("load-text", async () => {
  await save();
  const { w, c } = current();
  const result = await api("/api/text", {
    document_id: w.document_id,
    canvas_id: c.canvas_id,
  });
  mergeTextResult(workspace, w.document_id, result);
  renderTexts();
  status(
    `${result.texts.length}件の既存テキストを読み込みました。${result.diagnostics?.length ? " " + result.diagnostics.join("; ") : ""}`,
  );
});
action("export", async () => {
  const ids = [...document.querySelectorAll("input[name=region]:checked")].map(
    (e) => e.value,
  );
  if (!ids.length || ids.length > 4)
    throw new Error("1〜4領域を選んでください");
  await save();
  const result = await api("/api/export", {
    region_ids: ids,
    output_dir: $("export-dir").value,
    overwrite: false,
    image_permission_confirmed: $("image-permission").checked,
  });
  $("export-result").textContent = JSON.stringify(result, null, 2);
  status("読解資料を保存しました。画像をAIアプリで開いてください。");
});
function fileAction(id, fn) {
  $(id).onchange = async () => {
    try {
      const file = $(id).files[0];
      if (!file) return;
      if (file.size > 45 * 1024 * 1024)
        throw new Error("入力容量が上限を超えます");
      await fn(JSON.parse(await file.text()));
    } catch (e) {
      status(e.message);
    } finally {
      $(id).value = "";
    }
  };
}
fileAction("import-workspace", async (value) => {
  await api("/api/workspace", value);
  workspace = await api("/api/workspace");
  build();
  status("作業を読み込みました。");
});
fileAction("import-annotations", async (value) => {
  await save();
  workspace = await api("/api/annotations/import", value);
  build();
  status("領域を読み込みました。");
});
fileAction("import-text", async (value) => {
  await save();
  const { w, c } = current();
  const result = await api("/api/text/import", {
    document_id: w.document_id,
    canvas_id: c.canvas_id,
    text: value,
  });
  workspace.texts = [
    ...new Map(
      [...workspace.texts, ...result.texts].map((t) => [t.text_id, t]),
    ).values(),
  ];
  renderTexts();
  status("指定ページのテキストを読み込みました。");
});
$("active-window").onchange = () => {
  viewer.cancelSelection?.();
  pendingRegion = null;
  $("add-region").disabled = true;
  renderTexts();
};
try {
  if (!token) throw new Error("CLIが表示した起動URLを開いてください");
  workspace = await api("/api/workspace");
  ocrPanel = createOcrPanel({ element: $("ocr-panel"), workspace: () => workspace, current, status,
    openImage(text, line) {
      const { doc, source } = assertOcrTarget(workspace,text);
      const win = workspace.windows.find((w) => w.window_id === $("active-window").value && w.document_id === doc.document_id) ?? workspace.windows.find((w) => w.document_id === doc.document_id);
      if (!win) throw new Error("対応する資料の比較窓を開いてください");
      showRegion(viewer,{window_id:win.window_id,canvas_id:source.selection.canvas_id,xywh:line?.canvas_xywh ?? source.selection.xywh});
      $("active-window").value=win.window_id;
      status("OCR候補に対応する画像へ移動しました。原画像で文字を確認できます。");
    },
  });
  teiPanel = createTeiPanel({ element: $("tei-panel"), workspace: () => workspace, current, selectedRegions, status,
    openImage(link) {
      const win = workspace.windows.find((w) => w.window_id === $("active-window").value && w.document_id === link.document_id) ?? workspace.windows.find((w) => w.document_id === link.document_id);
      if (!win) throw new Error("対応する資料の比較窓を開いてください");
      const c = workspace.documents.find((d) => d.document_id === link.document_id).canvases.find((c) => c.canvas_id === link.target.canvas_id);
      showRegion(viewer, { window_id: win.window_id, canvas_id: c.canvas_id, xywh: link.target.xywh ?? [0, 0, c.width, c.height] });
      $("active-window").value = win.window_id;
      status("TEI本文に対応する画像へ移動しました。原画像を確認して校合を記録できます。");
    },
  });
  build();
  teiPanel.render();
  status(
    `${workspace.documents.length}資料を読み込みました。画像は各提供元から表示します。`,
  );
} catch (e) {
  status(e.message);
}
window.addEventListener("pagehide", () => viewer?.destroy());
