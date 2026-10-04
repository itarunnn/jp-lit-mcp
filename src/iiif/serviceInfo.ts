import { asObject, resourceId, scopedRights } from "./manifest.js";
import type { CanvasInfo, FetchedResource, ImageServiceInfo } from "./types.js";

export function normalizeServiceInfo(
  resource: FetchedResource,
  service: NonNullable<CanvasInfo["images"][number]["service"]>,
): ImageServiceInfo {
  const raw = asObject(JSON.parse(Buffer.from(resource.body).toString("utf8")));
  const declared = resourceId(raw);
  const version = /\/image\/3\/|ImageService3/.test(
    JSON.stringify([raw["@context"], raw.type]),
  )
    ? "3"
    : /\/image\/2\//.test(JSON.stringify(raw["@context"]))
      ? "2"
      : null;
  if (
    declared.replace(/\/$/, "") !== service.service_id.replace(/\/$/, "") ||
    version !== service.version ||
    ![raw.width, raw.height].every((v) => Number.isSafeInteger(v) && v > 0)
  )
    throw new Error("Image ServiceのID・API版・原画像寸法を確認できません");
  return {
    service_id: declared,
    version: version as "2" | "3",
    width: raw.width,
    height: raw.height,
    profile: raw.profile ?? null,
    rights: scopedRights(raw, `image_service:${declared}`),
    receipt: resource.receipt,
  };
}
