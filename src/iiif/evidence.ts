import { z } from "zod";
import path from "node:path";
import { mkdir, rm, rename, readdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  CanvasInfo,
  CropResult,
  RegionSelection,
  ExportEvidenceRequest,
  EvidenceExport,
  ImageServiceInfo,
  FetchedResource,
  ResourcePolicy,
} from "./types.js";
import { normalizeServiceInfo } from "./serviceInfo.js";
import { resourceId } from "./manifest.js";
import { parseIiifRequest } from "./schemas.js";
import { readWorkspace } from "./workspace.js";
import { loadPublicResource } from "./publicResource.js";
import { imageDimensions } from "./imageMetadata.js";
export function regionToImageCrop(
  selection: RegionSelection,
  canvas: CanvasInfo,
  info?: ImageServiceInfo,
): CropResult {
  const unsupported = (reason: string): CropResult => ({
    status: "unsupported",
    image_url: null,
    image_xywh: null,
    transform: null,
    diagnostics: [reason],
  });
  const [x, y, w, h] = selection.xywh;
  if (
    selection.canvas_id !== canvas.canvas_id ||
    ![x, y, w, h].every(Number.isFinite) ||
    x < 0 ||
    y < 0 ||
    w <= 0 ||
    h <= 0 ||
    x + w > canvas.width ||
    y + h > canvas.height
  )
    return unsupported("Canvas領域が不正です");
  if (canvas.images.length !== 1)
    return unsupported("cropは単一の全Canvas画像に対応します");
  const image = canvas.images[0],
    service = image.service;
  if (
    resourceId(image.target) !== canvas.canvas_id ||
    typeof image.target !== "string"
  )
    return unsupported("画像配置が全Canvasの単純painting以外です");
  if (
    !service ||
    !info ||
    info.version !== service.version ||
    info.service_id.replace(/\/$/, "") !==
      service.service_id.replace(/\/$/, "") ||
    ![info.width, info.height].every((v) => Number.isSafeInteger(v) && v > 0)
  )
    return unsupported("Image API 2/3のinfo.jsonで原画像寸法の確認が必要です");
  const profiles = Array.isArray(info.profile) ? info.profile : [info.profile];
  if (
    !profiles.some(
      (p) =>
        typeof p === "string" &&
        /^(?:https?:\/\/iiif.io\/api\/image\/[23]\/)?level[12](?:\.json)?$/.test(
          p,
        ),
    )
  )
    return unsupported(
      "任意領域・サイズに対応するImage API level1/2を確認してください",
    );
  const sx = info.width / canvas.width,
    sy = info.height / canvas.height;
  const ix = Math.floor(x * sx),
    iy = Math.floor(y * sy),
    iw = Math.min(info.width - ix, Math.ceil((x + w) * sx) - ix),
    ih = Math.min(info.height - iy, Math.ceil((y + h) * sy) - iy);
  const scale = Math.min(1, 2048 / Math.max(iw, ih));
  const dw = Math.max(1, Math.round(iw * scale)),
    dh = Math.max(1, Math.round(ih * scale));
  const image_xywh: [number, number, number, number] = [ix, iy, iw, ih];
  // level1の必須機能で縦横比を保ち、長辺だけを指定する。
  const size = iw >= ih ? `${dw},` : `,${dh}`;
  return {
    status: "supported",
    image_url: `${service.service_id.replace(/\/$/, "")}/${image_xywh.join(",")}/${size}/0/default.jpg`,
    image_xywh,
    transform: { scale_x: sx, scale_y: sy, display_max_edge: 2048 },
    diagnostics: [],
  };
}
export function validateAnalysis(value: unknown, evidenceIds: string[]) {
  const result = z
    .object({
      generated_by: z.string().min(1),
      executed_at: z.string().datetime(),
      items: z
        .array(
          z.object({
            evidence_id: z.string().min(1),
            observations: z.array(z.string()),
            transcription_candidate: z.string().nullable(),
            interpretation: z.string(),
            uncertainties: z.array(z.string()),
            verification_state: z.literal("ai_candidate"),
          }),
        )
        .min(1),
    })
    .parse(value);
  if (result.items.some((i) => !evidenceIds.includes(i.evidence_id)))
    throw new Error("AI記述のevidence_idが読解資料にありません");
  return result;
}
export async function exportEvidence(
  input: ExportEvidenceRequest,
  loadResource: (
    url: string,
    policy: ResourcePolicy,
  ) => Promise<FetchedResource> = loadPublicResource,
): Promise<EvidenceExport> {
  const request = parseIiifRequest(input);
  if (request.operation !== "export_evidence")
    throw new Error("export_evidenceを指定してください");
  const w = await readWorkspace(request.workspace_path);
  if (new Set(request.region_ids).size !== request.region_ids.length)
    throw new Error("領域IDが重複しています");
  const selected = request.region_ids.map((id) => {
    const r = w.regions.find((r) => r.selection.region_id === id);
    if (!r) throw new Error(`領域が見つかりません: ${id}`);
    return r;
  });
  const existing = await readdir(request.output_dir).catch(
    (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    },
  );
  if (existing !== null)
    throw new Error(
      "出力directoryが存在します。新しい保存先を指定してください",
    );
  const stage = path.join(
    path.dirname(request.output_dir),
    `.iiif-export-${randomUUID()}`,
  );
  await mkdir(stage, { recursive: true });
  const images: string[] = [],
    texts: string[] = [],
    diagnostics: string[] = [],
    items: unknown[] = [];
  const services = new Map<
    string,
    { info: ImageServiceInfo; raw: Uint8Array; raw_path: string }
  >();
  try {
    for (const [index, r] of selected.entries()) {
      const win = w.windows.find((v) => v.window_id === r.selection.window_id)!;
      const d = w.documents.find((d) => d.document_id === win.document_id)!;
      const c = d.canvases.find((c) => c.canvas_id === r.selection.canvas_id)!;
      const name = `region-${index + 1}`;
      const image = c.images[0],
        service = image?.service;
      let metadata:
        | { info: ImageServiceInfo; raw: Uint8Array; raw_path: string }
        | undefined;
      if (
        request.image_permission_confirmed &&
        c.images.length === 1 &&
        typeof image.target === "string" &&
        image.target === c.canvas_id &&
        service &&
        ["2", "3"].includes(service.version)
      ) {
        metadata = services.get(service.service_id);
        if (!metadata) {
          const fetched = await loadResource(
            `${service.service_id.replace(/\/$/, "")}/info.json`,
            {
              max_bytes: 2 * 1024 * 1024,
              timeout_ms: 15000,
              max_redirects: 3,
              kind: "json",
            },
          );
          metadata = {
            info: normalizeServiceInfo(fetched, service),
            raw: fetched.body,
            raw_path: `${name}.info.json`,
          };
          await writeFile(path.join(stage, metadata.raw_path), metadata.raw);
          services.set(service.service_id, metadata);
        }
      }
      const crop = regionToImageCrop(r.selection, c, metadata?.info);
      let display: unknown = null;
      if (crop.status === "supported" && request.image_permission_confirmed) {
        const resource = await loadResource(crop.image_url!, {
          max_bytes: 10 * 1024 * 1024,
          timeout_ms: 15000,
          max_redirects: 3,
          kind: "image",
          max_pixels: 16000000,
        });
        const dims = imageDimensions(resource.body);
        if (Math.max(dims.width, dims.height) > 2048)
          throw new Error("表示画像の長辺上限2048を超えます");
        const file = `${name}.${dims.format}`;
        await writeFile(path.join(stage, file), resource.body);
        images.push(file);
        display = {
          path: file,
          receipt: resource.receipt,
          width: dims.width,
          height: dims.height,
          canvas_to_image: crop.transform,
          original_image_xywh: crop.image_xywh,
          scale_x: dims.width / crop.image_xywh![2],
          scale_y: dims.height / crop.image_xywh![3],
          verification_state: "image_fetched",
        };
      } else
        diagnostics.push(
          `${r.selection.region_id}: ${crop.status === "unsupported" ? crop.diagnostics.join("; ") : "画像取得の利用確認を保留しています"}`,
        );
      const linked = w.texts.filter((t) =>
        r.text_evidence_ids.includes(t.text_id),
      );
      const file = `${name}.txt`;
      await writeFile(
        path.join(stage, file),
        linked
          .map(
            (t) =>
              `[${t.text_id}] ${t.origin} / ${t.verification_state}\n${t.text}`,
          )
          .join("\n\n"),
        "utf8",
      );
      texts.push(file);
      items.push({
        evidence_id: r.selection.region_id,
        selection: r.selection,
        tags: r.tags,
        selection_reason: r.selection_reason,
        note: r.note,
        source: {
          document_id: d.document_id,
          candidate: d.candidate,
          receipt: d.receipt,
          declared_id: d.declared_id,
          label: d.label,
          sequence_id: d.selected_sequence_id,
          rights: [
            ...d.rights,
            ...c.rights,
            ...(image?.rights ?? []),
            ...(metadata?.info.rights ?? []),
          ],
        },
        canvas: {
          canvas_id: c.canvas_id,
          label: c.label,
          canvas_index_1based: c.canvas_index_1based,
          width: c.width,
          height: c.height,
        },
        crop,
        image_service: metadata
          ? { ...metadata.info, raw_path: metadata.raw_path }
          : null,
        original_image: {
          url: c.images[0]?.image_id ?? null,
          sha256: null,
          verification_state: "manifest_declared",
        },
        display_image: display,
        text_evidence: linked,
        text_path: file,
        image_permission_confirmed: request.image_permission_confirmed,
      });
    }
    await writeFile(
      path.join(stage, "evidence.json"),
      JSON.stringify(
        {
          schema_version: "0.1",
          exported_at: new Date().toISOString(),
          workspace_id: w.workspace_id,
          workspace_path: request.workspace_path,
          items,
          diagnostics,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(stage, "prompt.md"),
      "選択した画像を実際に開き、見える特徴・翻刻候補・解釈・疑義を出典付きで比較してください。\n\n各記述の evidence_id は evidence.json のIDを使ってください。画像未取得の場合は画像観察を保留してください。原テキストとAI候補を分け、analysis.json / analysis.mdへ保存してください。AI候補は ai_candidate とし、原画像との校合を別に記録してください。\n\n出典へ戻るには evidence.json の workspace_path を開き、evidence_idの領域へ移動します。\n",
    );
    await writeFile(
      path.join(stage, "analysis-template.json"),
      JSON.stringify(
        {
          generated_by: "",
          executed_at: "",
          items: selected.map((r) => ({
            evidence_id: r.selection.region_id,
            observations: [],
            transcription_candidate: null,
            interpretation: "",
            uncertainties: [],
            verification_state: "ai_candidate",
          })),
        },
        null,
        2,
      ) + "\n",
    );
    await rename(stage, request.output_dir);
    return {
      evidence_json_path: path.join(request.output_dir, "evidence.json"),
      prompt_path: path.join(request.output_dir, "prompt.md"),
      image_paths: images.map((f) => path.join(request.output_dir, f)),
      text_paths: texts.map((f) => path.join(request.output_dir, f)),
      diagnostics,
    };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
