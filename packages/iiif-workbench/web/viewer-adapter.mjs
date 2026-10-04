export function validLayout(layout, windowIds) {
  const leaves=[];
  function visit(value,depth=0) {
    if(depth>4)return false;
    if(typeof value==='string'){leaves.push(value);return windowIds.includes(value);}
    return value && ['row','column'].includes(value.direction) && (value.splitPercentage===undefined || (Number.isFinite(value.splitPercentage)&&value.splitPercentage>0&&value.splitPercentage<100)) && visit(value.first,depth+1)&&visit(value.second,depth+1);
  }
  return Boolean(visit(layout)&&leaves.length===windowIds.length&&new Set(leaves).size===leaves.length);
}
export function createViewer(element, workspace, token) {
  const handles = new Map(),
    restored = new Set();
  const handle = { workspace, handles, viewer: null, cancelSelection: null, pendingFocus:new Map() };
  const saved =
    workspace.viewer_state?.adapter_version === "mirador-4.2.6-v1"
      ? workspace.viewer_state.native_state
      : null;
  function restore(id, viewer) {
    if (restored.has(id) || !viewer.world.getItemCount()) return;
    restored.add(id);
    const p = saved?.viewports?.[id];
    if (
      p &&
      [p.x, p.y, p.zoom, p.rotation].every(Number.isFinite) &&
      p.zoom > 0 &&
      p.zoom < 1e6 &&
      Math.abs(p.x) < 1e9 &&
      Math.abs(p.y) < 1e9
    ) {
      const center = viewer.viewport.getCenter(true).clone();
      center.x = p.x;
      center.y = p.y;
      viewer.viewport.setRotation(p.rotation);
      viewer.viewport.zoomTo(p.zoom, null, true);
      viewer.viewport.panTo(center, true);
    }
  }
  const plugin = {
    name: "jp-lit-region-bridge",
    target: "OpenSeadragonViewer",
    mode: "add",
    component(p) {
      if (p.viewer) {
        const previous = handles.get(p.windowId);
        handles.set(p.windowId, {
          viewer: p.viewer,
          canvasWorld: p.canvasWorld,
        });
        if (previous?.viewer !== p.viewer)
          p.viewer.world.addHandler("add-item", () => {
            restore(p.windowId,p.viewer);
            const selection=handle.pendingFocus.get(p.windowId);
            if(selection&&focusRegion(handle,selection))handle.pendingFocus.delete(p.windowId);
          });
        restore(p.windowId, p.viewer);
      }
      return null;
    },
  };
  const origin = location.origin;
  handle.viewer = Mirador.viewer(
    {
      id: element.id,
      language: "ja",
      enabledLanguages: ["ja", "en"],
      windows: workspace.windows.map((w) => ({
        id: w.window_id,
        manifestId: `${origin}/api/manifest/${encodeURIComponent(w.document_id)}`,
        canvasId: w.canvas_id,
      })),
      window: {
        allowClose: false,
        allowTopMenuButton: false,
        allowWindowSideBar: false,
        defaultView: "single",
      },
      workspace: { type: "mosaic", allowNewWindows: false },
      workspaceControlPanel: { enabled: false },
      requests: {
        preprocessors: [
          (url, options) =>
            url.startsWith(origin + "/api/manifest/")
              ? {
                  ...options,
                  headers: { ...options.headers, "x-iiif-token": token },
                }
              : options,
        ],
      },
      theme: {
        palette: { primary: { main: "#245b57" } },
        typography: { fontFamily: '"Yu Gothic UI", Meiryo, sans-serif' },
      },
    },
    [plugin],
  );
  let unsubscribe=()=>{};
  if(validLayout(saved?.layout,workspace.windows.map(w=>w.window_id))) {
    const restoreLayout=()=>{if(workspace.windows.every(w=>handle.viewer.store.getState().windows[w.window_id])){unsubscribe();handle.viewer.store.dispatch(Mirador.updateWorkspaceMosaicLayout(saved.layout));return true;}return false;};
    if(!restoreLayout())unsubscribe=handle.viewer.store.subscribe(restoreLayout);
  }
  handle.destroy = () => {
    unsubscribe();
    handle.cancelSelection?.();
    handle.viewer.unmount();
    handles.clear();
  };
  return handle;
}
export function readViewerState(handle) {
  const state = handle.viewer.store.getState();
  const windows = handle.workspace.windows.map((w) => ({
    ...w,
    canvas_id: state.windows[w.window_id]?.canvasId ?? w.canvas_id,
  }));
  const viewports = {};
  for (const [id, { viewer }] of handle.handles) {
    const p = viewer.viewport.getCenter(true);
    viewports[id] = {
      x: p.x,
      y: p.y,
      zoom: viewer.viewport.getZoom(true),
      rotation: viewer.viewport.getRotation(),
    };
  }
  return {
    adapter_version: "mirador-4.2.6-v1",
    windows,
    native_state: { viewports, layout:state.workspace.layout },
  };
}
export function setCanvas(handle, windowId, canvasId) {
  handle.cancelSelection?.();
  handle.viewer.store.dispatch(Mirador.setCanvas(windowId, canvasId));
}
export function showRegion(handle, selection) {
  const current=handle.viewer.store.getState().windows[selection.window_id]?.canvasId;
  if(current!==selection.canvas_id)handle.pendingFocus.set(selection.window_id,selection);
  setCanvas(handle, selection.window_id, selection.canvas_id);
  if(current===selection.canvas_id)focusRegion(handle,selection);
}
function focusRegion(handle,selection) {
  const h = handle.handles.get(selection.window_id);
  if (h?.canvasWorld.canvasIds.includes(selection.canvas_id)) {
    const [cx, cy, cw, ch] = h.canvasWorld.canvasToWorldCoordinates(
        selection.canvas_id,
      ),
      doc = handle.workspace.documents.find(
        (d) =>
          d.document_id ===
          handle.workspace.windows.find(
            (w) => w.window_id === selection.window_id,
          )?.document_id,
      ),
      canvas = doc?.canvases.find((c) => c.canvas_id === selection.canvas_id);
    if (canvas) {
      const b = h.viewer.viewport.getBounds(true).clone();
      const [x, y, w, hg] = selection.xywh;
      Object.assign(b, {
        x: cx + (x * cw) / canvas.width,
        y: cy + (y * ch) / canvas.height,
        width: (w * cw) / canvas.width,
        height: (hg * ch) / canvas.height,
      });
      h.viewer.viewport.setRotation(0);
      h.viewer.viewport.fitBounds(b, true);
      return true;
    }
  }
  return false;
}
export function selectRegion(handle, windowId) {
  handle.cancelSelection?.();
  const h = handle.handles.get(windowId),
    win = handle.viewer.store.getState().windows[windowId];
  const doc = handle.workspace.documents.find(
      (d) =>
        d.document_id ===
        handle.workspace.windows.find((w) => w.window_id === windowId)
          ?.document_id,
    ),
    canvas = doc?.canvases.find((c) => c.canvas_id === win?.canvasId);
  if (
    !h ||
    !canvas ||
    h.viewer.world.getItemCount() !== 1 ||
    !h.canvasWorld.canvasIds.includes(canvas.canvas_id)
  )
    return Promise.reject(
      new Error("ページの画像が表示されてから矩形を選んでください"),
    );
  const rotation = h.viewer.viewport.getRotation();
  if (Math.abs(rotation / 90 - Math.round(rotation / 90)) > 1e-6)
    return Promise.reject(
      new Error("矩形選択は0・90・180・270度で行ってください"),
    );
  const layer = document.createElement("div");
  layer.className = "selection-layer";
  const box = document.createElement("div");
  box.className = "selection-box";
  layer.append(box);
  h.viewer.element.append(layer);
  return new Promise((resolve, reject) => {
    let start;
    const cleanup = () => {
      layer.remove();
      document.removeEventListener("keydown", keydown);
      handle.cancelSelection = null;
    };
    handle.cancelSelection = () => {
      cleanup();
      reject(new Error("領域選択を取り消しました"));
    };
    const keydown = (e) => {
      if (e.key === "Escape") handle.cancelSelection?.();
    };
    document.addEventListener("keydown", keydown);
    const position = (e) => {
      const r = layer.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    layer.onpointerdown = (e) => {
      start = position(e);
      layer.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    layer.onpointermove = (e) => {
      if (!start) return;
      const p = position(e);
      Object.assign(box.style, {
        left: Math.min(start[0], p[0]) + "px",
        top: Math.min(start[1], p[1]) + "px",
        width: Math.abs(start[0] - p[0]) + "px",
        height: Math.abs(start[1] - p[1]) + "px",
      });
    };
    layer.onpointerup = (e) => {
      if (!start) return;
      const end = position(e);
      const [cx, cy, cw, ch] = h.canvasWorld.canvasToWorldCoordinates(
        canvas.canvas_id,
      );
      const points = [
        [start[0], start[1]],
        [end[0], start[1]],
        [end[0], end[1]],
        [start[0], end[1]],
      ].map(([x, y]) => {
        const p = h.viewer.viewport.getCenter(true).clone();
        p.x = x;
        p.y = y;
        const world = h.viewer.viewport.pointFromPixel(p, true);
        return [
          ((world.x - cx) * canvas.width) / cw,
          ((world.y - cy) * canvas.height) / ch,
        ];
      });
      const x = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0])))),
        y = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
      const right = Math.min(
          canvas.width,
          Math.ceil(Math.max(...points.map((p) => p[0]))),
        ),
        bottom = Math.min(
          canvas.height,
          Math.ceil(Math.max(...points.map((p) => p[1]))),
        );
      cleanup();
      if (right <= x || bottom <= y) {
        reject(new Error("Canvas内に矩形を選んでください"));
        return;
      }
      resolve({
        region_id: crypto.randomUUID(),
        window_id: windowId,
        canvas_id: canvas.canvas_id,
        xywh: [x, y, right - x, bottom - y],
        coordinate_space: "canvas",
        rotation_degrees: rotation,
      });
    };
  });
}
