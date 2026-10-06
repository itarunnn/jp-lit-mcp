export const KURONET_VIEWER_URL = "https://codh.rois.ac.jp/kuronet/iiif-curation-viewer/";
export const KURONET_GUIDE_URL = "https://mp.ex.nii.ac.jp/kuronet/";

export function manualOcrSource(workspace, regionId) {
  const region = workspace.regions.find((r) => r.selection.region_id === regionId);
  const window = workspace.windows.find((w) => w.window_id === region?.selection.window_id);
  const doc = workspace.documents.find((d) => d.document_id === window?.document_id);
  const canvas = doc?.canvases.find((c) => c.canvas_id === region?.selection.canvas_id);
  if (!region || !doc || !canvas) throw new Error("対象の資料と領域を選んでください");
  return { region, doc, canvas, source: {
    workspace_id: workspace.workspace_id, document_id: doc.document_id, manifest_sha256: doc.receipt.sha256,
    selection: structuredClone(region.selection), canvas_width: canvas.width, canvas_height: canvas.height,
  } };
}

export function assertManualOcrTarget(workspace, text) {
  const p = text.manual_ocr_provenance;
  if (!p || text.ocr_provenance || text.origin !== "ocr_candidate" || text.verification_state !== "unverified") throw new Error("手動取込のOCR候補を指定してください");
  const target = manualOcrSource(workspace, p.source.selection.region_id);
  if (JSON.stringify(target.source) !== JSON.stringify(p.source) || text.canvas_id !== target.canvas.canvas_id ||
      JSON.stringify(text.target_xywh) !== JSON.stringify(p.source.selection.xywh)) throw new Error("手動OCRの出典と現在の資料・領域が一致しません");
  return target;
}
