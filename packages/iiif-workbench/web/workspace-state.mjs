export function mergeTextResult(workspace, documentId, result) {
  const doc = workspace.documents.find((d) => d.document_id === documentId);
  if (!doc) throw new Error("資料が見つかりません");
  workspace.texts = [
    ...new Map([...workspace.texts, ...result.texts].map((t) => [t.text_id, t])).values(),
  ];
  doc.diagnostics = [...new Set([...doc.diagnostics, ...(result.diagnostics ?? [])])];
}

export function addComparisonWindow(workspace, sourceWindowId, newWindowId) {
  const current = workspace.windows.find((w) => w.window_id === sourceWindowId);
  if (!current) throw new Error("比較元の窓が見つかりません");
  if (workspace.windows.length >= 4) throw new Error("比較は4窓までです");
  workspace.windows.push({ ...current, window_id: newWindowId });
}
