import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { command, ownedContainer, host, gpuProbe } from "./ocrGpu.js";
import { ndlOcrEngineSchema, ndlOcrConfigSchema, ocrAbsoluteSchema, ocrHashSchema } from "./ocrSchemas.js";

export async function inspectNdlOcrProvider(input: { docker_path?: string; image_id?: string }) {
  const parsed = z.object({ docker_path: ocrAbsoluteSchema, image_id: z.string().regex(/^sha256:[a-f0-9]{64}$/) }).parse(input);
  const docker_path = await realpath(parsed.docker_path);
  if (!(await lstat(docker_path)).isFile()) throw new Error("Docker実行fileを指定してください");
  const inspected = await command(docker_path, ["image", "inspect", parsed.image_id, "--format", "{{.Id}}"], 15000);
  if (inspected.stdout.trim() !== parsed.image_id) throw new Error("Docker image IDが一致しません");
  const result = await ownedContainer(docker_path, ["--env", "PYTHONDONTWRITEBYTECODE=1", "--entrypoint", "python3", parsed.image_id, "-c", gpuProbe("/root/ocr_cli")], 60000);
  const metadata = z.object({ python_version: z.string().min(1), torch_version: z.string().min(1), cuda_version: z.string().min(1), gpu: z.string().min(1),
    files: z.array(z.object({ path: z.string().min(1).max(4096), sha256: ocrHashSchema }).strict()).min(1).max(1000) }).strict().parse(JSON.parse(result.stdout));
  const names = metadata.files.map(f => f.path);
  if (new Set(names).size !== names.length || names.some(p => p.startsWith("/") || p.includes("\\") || p.split("/").some(v => !v || v === "." || v === ".."))) throw new Error("NDLOCR engine fileの記録を確認してください");
  for (const required of ["main.py", "config.yml", "cli/core/inference.py", "submodules/ndl_layout/models/ndl_retrainmodel.pth",
    "submodules/text_recognition_lightning/models/resnet-orient2.ckpt", "submodules/text_recognition_lightning/ndldata/mojilist_NDL.txt"])
    if (!names.includes(required)) throw new Error(`NDLOCR engine fileを確認してください: ${required}`);
  const engine_sha256 = createHash("sha256").update(JSON.stringify({ image_id: parsed.image_id, ...metadata })).digest("hex");
  const engine = ndlOcrEngineSchema.parse({ provider: "ndlocr-ver2", runtime: "docker", model_version: "2.1", docker_path, docker_host: host, image_id: parsed.image_id, engine_sha256, ...metadata });
  return { engine, config: ndlOcrConfigSchema.parse({ provider: engine.provider, docker_path, image_id: engine.image_id, expected_engine_sha256: engine_sha256 }) };
}

export async function runNdlOcrImage(engine: z.infer<typeof ndlOcrEngineSchema>, imagePath: string, rawDir: string, timeout: number) {
  const input = await realpath(imagePath), output = await realpath(rawDir);
  if ([input, output].some(p => /[,"\r\n]/.test(p))) throw new Error("Docker mountのpathにcomma・引用符・改行を含められません");
  return ownedContainer(engine.docker_path, [
    "--env", "HF_HUB_OFFLINE=1", "--env", "TRANSFORMERS_OFFLINE=1", "--env", "HF_DATASETS_OFFLINE=1", "--env", "PYTHONDONTWRITEBYTECODE=1",
    "--workdir", "/root/ocr_cli", "--entrypoint", "python3",
    "--mount", `type=bind,source=${input},target=/input/${path.basename(input)},readonly`, "--mount", `type=bind,source=${output},target=/out`,
    engine.image_id, "main.py", "infer", `/input/${path.basename(input)}`, "/out/native", "-s", "f", "-p", "2..3", "-x",
  ], timeout);
}
