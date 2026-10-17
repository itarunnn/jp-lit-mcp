import { afterEach, expect, it, vi } from "vitest";
import { createViewer, showRegion, readViewerState } from "../packages/iiif-workbench/web/viewer-adapter.mjs";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const workspace = sampleWorkspace(), first = workspace.documents[0].canvases[0].canvas_id, second = "https://example.org/c2";
  workspace.documents[0].canvases.push({ ...workspace.documents[0].canvases[0], canvas_id: second });
  const windowId = workspace.windows[0].window_id, state = { windows: { [windowId]: { canvasId: first } }, workspace: { layout: null } };
  // 外部Mirador/OSD境界。fitBoundsで変化した位置を本番readViewerStateから検査する。
  const handlers = new Map<string, Function[]>(), worldHandlers = new Map<string, Function[]>();
  let center = { x: 500, y: 1000 }, zoom = 1;
  const viewport = { getCenter: () => ({ ...center, clone() { return { ...center }; } }), getZoom: () => zoom, getRotation: () => 0, setRotation() {},
    getBounds: () => ({ clone: () => ({ x: 0, y: 0, width: 1000, height: 2000 }) }),
    fitBounds: (r: any) => { center = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; zoom = 1000 / r.width; } };
  const osd = { viewport, world: { getItemCount: () => 1, addHandler: (name: string, fn: Function) => worldHandlers.set(name, [...(worldHandlers.get(name) ?? []), fn]) },
    addHandler: (name: string, fn: Function) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) };
  let plugin: any;
  vi.stubGlobal("location", { origin: "http://127.0.0.1:3000" });
  vi.stubGlobal("Mirador", { setCanvas: (id: string, canvas: string) => ({ id, canvas }), viewer: (_config: any, plugins: any[]) => {
    plugin = plugins[0]; return { store: { getState: () => state, dispatch: (a: any) => { state.windows[a.id as keyof typeof state.windows].canvasId = a.canvas; } }, unmount() {} };
  } });
  const handle = createViewer({ id: "viewer" }, workspace, "synthetic-token");
  const render = (id: string) => plugin.component({ windowId, viewer: osd, canvasWorld: { canvasIds: [id], canvasToWorldCoordinates: () => [0,0,1000,2000] } });
  render(first);
  function loaded() {
    render(second);
    for (const fn of worldHandlers.get("add-item") ?? []) fn();
    for (const fn of handlers.get("tile-loaded") ?? []) fn();
    // Mirador 4.2.6は新しい画像のtile-loadedで全ページへ再配置する。
    viewport.fitBounds({ x: 0, y: 0, width: 1000, height: 2000 });
  }
  return { handle, second, windowId, loaded, render };
}

it("retains the requested line focus after the destination page loads and Mirador recenters", async () => {
  const f = fixture();
  showRegion(f.handle, { window_id: f.windowId, canvas_id: f.second, xywh: [100,200,300,400] });
  f.loaded(); await Promise.resolve();
  const saved = readViewerState(f.handle);
  expect(saved.windows[0].canvas_id).toBe(f.second);
  expect(saved.native_state.viewports[f.windowId]).toMatchObject({ x: 250, y: 400 });
});

it("uses the latest requested line while its page is still loading", async () => {
  const f = fixture();
  showRegion(f.handle, { window_id: f.windowId, canvas_id: f.second, xywh: [100,200,300,400] });
  f.render(f.second); // Reactの対象頁だけ更新され、最初のtileはまだ到着していない。
  showRegion(f.handle, { window_id: f.windowId, canvas_id: f.second, xywh: [500,600,100,200] });
  f.loaded(); await Promise.resolve();
  expect(readViewerState(f.handle).native_state.viewports[f.windowId]).toMatchObject({ x: 550, y: 700 });
});
