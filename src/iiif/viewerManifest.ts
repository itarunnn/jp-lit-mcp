import type { ManifestDocument } from "./types.js";
import { isIP } from "node:net";
import { isPublicAddress, validatePublicUrl } from "./publicResource.js";
export function safeDisplayUrl(value: string): string | null {
  try {
    const u = new URL(value),
      host = u.hostname.replace(/^\[|\]$/g, "");
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      (u.port && u.port !== "443") ||
      (isIP(host) && !isPublicAddress(host)) ||
      /token|credential|password|signature|^sig$|auth|cookie|session|^key$/i.test(
        [...u.searchParams.keys()].join(" "),
      )
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export async function viewerManifest(document: ManifestDocument) {
  const urls = new Set<string>();
  for (const c of document.canvases)
    for (const im of c.images) {
      urls.add(im.image_id);
      if (im.service) urls.add(im.service.service_id);
    }
  const hosts = new Set<string>();
  for (const value of urls) {
    const safe = safeDisplayUrl(value);
    if (!safe) throw new Error("表示URLにpublic HTTPS以外の指定があります");
    const host = new URL(safe).host;
    if (!hosts.has(host)) {
      await validatePublicUrl(safe);
      hosts.add(host);
    }
  }
  const label = (values: ManifestDocument["label"]) =>
    Object.fromEntries(values.map((t) => [t.language ?? "none", t.values]));
  return {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: document.declared_id,
    type: "Manifest",
    label: label(document.label),
    items: document.canvases.map((c) => ({
      id: c.canvas_id,
      type: "Canvas",
      label: label(c.label),
      width: c.width,
      height: c.height,
      items: [
        {
          id: `${c.canvas_id}#painting-page`,
          type: "AnnotationPage",
          items: c.images
            .filter((im) => typeof im.target === "string")
            .map((im, i) => ({
              id: `${c.canvas_id}#painting-${i}`,
              type: "Annotation",
              motivation: "painting",
              target: im.target,
              body: {
                id: im.image_id,
                type: "Image",
                ...(im.width ? { width: im.width } : {}),
                ...(im.height ? { height: im.height } : {}),
                format: "image/jpeg",
                ...(im.service
                  ? {
                      service: [
                        {
                          id: im.service.service_id,
                          type: `ImageService${im.service.version}`,
                          profile:
                            JSON.stringify(im.service.profile).match(
                              /level[012]/,
                            )?.[0] ?? "level0",
                        },
                      ],
                    }
                  : {}),
              },
            })),
        },
      ],
    })),
  };
}
