import path from "node:path";
import { realpath } from "node:fs/promises";
import { ocrRunSchema } from "./ocrSchemas.js";
import { readOcrFile, ocrEvidenceSchema } from "./ocrRunner.js";
import type { IiifWorkspace } from "./types.js";

async function canonical(file: string): Promise<string> {
  try { return await realpath(file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = path.dirname(file); if (parent === file) throw error;
    return path.join(await canonical(parent), path.basename(file));
  }
}
function inside(root: string, target: string) {
  const normalize = (p: string) => process.platform === "win32" ? p.toLowerCase() : p;
  const relative = path.relative(normalize(root), normalize(target));
  return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export async function assertDistinctOutput(outputPath: string, protectedPaths: Iterable<string>) {
  const output = await canonical(outputPath);
  for (const input of new Set(protectedPaths)) if (inside(await canonical(input), output))
    throw new Error("保存先を原入力・原資料・engineと別にしてください");
}

/** workspaceの全参照を保護する。原runが読めない場合は保存を進めない。 */
export async function protectWorkspaceSources(outputPath: string, workspace: IiifWorkspace, additionalInputs: string[] = []) {
  const protectedPaths = new Set(additionalInputs);
  const runs = new Set<string>();
  for (const link of workspace.tei_links ?? []) protectedPaths.add(link.file_path);
  for (const text of workspace.texts) {
    const reading=text.reading_provenance;
    if(reading) {
      runs.add(reading.task.base_run_path);
      for(const file of [path.dirname(reading.task_path),reading.response_path,reading.image_path,reading.task.base_run_path])protectedPaths.add(file);
    }
    const p = text.ocr_provenance; if (!p) continue;
    runs.add(p.run_path);
    const enginePaths=p.engine.provider==="ndlkotenocr-lite"?[p.engine.engine_dir,p.engine.python_path]:[p.engine.docker_path];
    for (const file of [p.run_path, p.evidence_path, ...enginePaths]) protectedPaths.add(file);
    for (const artifact of p.artifacts) protectedPaths.add(path.resolve(path.dirname(p.run_path), artifact.path));
  }
  await assertDistinctOutput(outputPath, protectedPaths);
  for (const runPath of runs) {
    const parse = (bytes: Buffer) => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    const run = ocrRunSchema.parse(parse(await readOcrFile(runPath, 32 * 1024 * 1024)));
    for(const file of run.engine.provider==="ndlkotenocr-lite"?[run.engine.engine_dir,run.engine.python_path]:[run.engine.docker_path])protectedPaths.add(file);
    protectedPaths.add(run.evidence_path);
    const evidencePath = path.join(path.dirname(runPath), "evidence.json");
    protectedPaths.add(evidencePath);
    const evidence = ocrEvidenceSchema.parse(parse(await readOcrFile(evidencePath)));
    for (const item of evidence.items) {
      const display = (item as { display_image?: { path?: unknown } }).display_image;
      if (typeof display?.path === "string") protectedPaths.add(path.resolve(path.dirname(run.evidence_path), display.path));
    }
    for (const item of run.items) for (const artifact of item.artifacts)
      protectedPaths.add(path.resolve(path.dirname(runPath), artifact.path));
  }
  await assertDistinctOutput(outputPath, protectedPaths);
}
