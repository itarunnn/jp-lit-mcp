import { request } from "node:http";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { normalizeKotenOutput } from "./ocr.js";
import type { OcrSource } from "./ocrSchemas.js";
import {
  localOcrInspectionSchema, localOcrEndpointSchema, localOcrConfigSchema,
  localOcrEngineSchema, localOcrMetadataSchema, localOcrMetadataHash, type LocalOcrEngine,
} from "./localOcrSchemas.js";

/** Numeric loopback only; node:http does not use proxy environment variables or follow redirects. */
async function localRequest(base: string, route: string, timeout: number, body?: string) {
  localOcrEndpointSchema.parse(base);
  const maxBytes = body === undefined ? 65536 : 4 * 1024 * 1024;
  return new Promise<{ status: number; bytes: Buffer }>((resolve, reject) => {
    const req = request(base + route, {
      method: body === undefined ? "GET" : "POST", agent: false,
      headers: { Accept: "application/json", "Accept-Encoding": "identity",
        ...(body === undefined ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }) },
    }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) req.destroy(new Error("Local OCRの応答容量が上限を超えます"));
        else chunks.push(chunk);
      });
      res.on("end", () => { clearTimeout(timer); resolve({ status: res.statusCode ?? 0, bytes: Buffer.concat(chunks) }); });
      res.on("error", error => { clearTimeout(timer); reject(error); });
      res.on("aborted", () => { clearTimeout(timer); reject(new Error("Local OCRの応答が中断されました")); });
    });
    const timer = setTimeout(() => req.destroy(new Error("Local OCRの応答時間が上限を超えます")), timeout);
    req.on("error", error => { clearTimeout(timer); reject(error); });
    req.end(body);
  });
}

export async function inspectLocalOcrProvider(input: unknown) {
  const config = localOcrInspectionSchema.parse(input);
  const response = await localRequest(config.base_url, "/v1/engines", Math.min(config.timeout_ms, 15000));
  if (response.status !== 200) throw new Error(`Local OCRのengine確認に失敗しました（HTTP ${response.status}）`);
  const { engines } = z.object({ engines: z.array(z.object({ id: z.string() }).passthrough()).max(64) })
    .parse(JSON.parse(response.bytes.toString("utf8")));
  const matches = engines.filter(engine => engine.id === config.engine_id);
  if (matches.length !== 1) throw new Error("Local OCRのndl-liteを確認してください");
  const metadata = localOcrMetadataSchema.parse(matches[0]);
  if (!metadata.ready) throw new Error("Local OCRでndl-liteのモデルを取得してください");
  if (!metadata.modes.includes(config.mode)) throw new Error("Local OCRの対応modeを確認してください");
  const metadata_sha256 = localOcrMetadataHash(metadata);
  return {
    engine: localOcrEngineSchema.parse({ provider: "local-ocr", runtime: "http", base_url: config.base_url,
      engine_id: config.engine_id, mode: config.mode, metadata, metadata_sha256,
      identity_verification: "service_metadata_only", engine_sha256: null, service_version: null, model_version: null }),
    config: localOcrConfigSchema.parse({ ...config, expected_metadata_sha256: metadata_sha256 }),
  };
}

const number = z.number().finite();
const localOutputSchema = z.object({
  engine: z.literal("ndl-lite"), mode: z.enum(["layout", "line"]), region: z.null(),
  width: number.int().positive(), height: number.int().positive(), seconds: number.nonnegative(),
  text: z.string().max(2 * 1024 * 1024),
  lines: z.array(z.object({ text: z.string().max(2 * 1024 * 1024),
    box: z.object({ x: number.nonnegative(), y: number.nonnegative(), w: number.positive(), h: number.positive() }).nullable(),
    polygon: z.array(z.tuple([number, number])).max(32).nullable(),
  })).max(10000),
});

export function normalizeLocalOcrOutput(input: unknown, text: string, source: OcrSource, engine: LocalOcrEngine) {
  const raw = localOutputSchema.parse(input);
  if (raw.engine !== engine.engine_id || raw.mode !== engine.mode || raw.width !== source.image_width || raw.height !== source.image_height)
    throw new Error("Local OCRのengine・mode・画像寸法が一致しません");
  if (raw.text !== text || (raw.lines.length && raw.text !== raw.lines.map(line => line.text).join("\n")))
    throw new Error("Local OCRの本文と行が一致しません");
  return normalizeKotenOutput({ imginfo: { img_width: raw.width, img_height: raw.height },
    contents: [raw.lines.flatMap((line, index) => {
      if (!line.box) return [];
      const { x, y, w, h } = line.box;
      return [{ id: String(index), text: line.text, boundingBox: [[x,y],[x,y+h],[x+w,y],[x+w,y+h]] }];
    })] }, source);
}

export async function runLocalOcrImage(engine: LocalOcrEngine, image: Buffer, jsonPath: string, textPath: string, timeout: number) {
  const response = await localRequest(engine.base_url, "/v1/ocr", timeout,
    JSON.stringify({ engine: engine.engine_id, mode: engine.mode, image: image.toString("base64") }));
  await writeFile(jsonPath, response.bytes, { flag: "wx" });
  if (response.status !== 200) throw new Error(`Local OCRに失敗しました（HTTP ${response.status}）。原応答を確認してください`);
  const raw = localOutputSchema.parse(JSON.parse(response.bytes.toString("utf8")));
  await writeFile(textPath, raw.text, { flag: "wx" });
  return { raw, text: raw.text };
}
