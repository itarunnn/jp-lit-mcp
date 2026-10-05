import path from "node:path";
import { realpath } from "node:fs/promises";
import { z } from "zod";
import { compareOcrText } from "./ocrMetrics.js";
import { importOcr } from "./ocrImport.js";
import { ocrAbsoluteSchema, ocrHashSchema, ocrRunSchema } from "./ocrSchemas.js";
import { ocrDigest, readOcrFile } from "./ocrRunner.js";
import { atomicWrite } from "./workspace.js";
import { validateWorkspace } from "./schemas.js";
// @ts-expect-error Nodeとブラウザで共有する対応検査
import { assertOcrTarget } from "./ocr-state.mjs";

const id = z.string().trim().min(1).max(4096), text = z.string().max(20000);
const review = z.object({ author: id, recorded_at: z.string().datetime(), note: id }).strict();
const reference = z.object({ scope: z.literal("full_region"), text, text_sha256: ocrHashSchema,
  origin: z.enum(["published_transcription", "human_transcription"]), source_ref: id,
  verification: z.enum(["unreviewed", "source_collated"]), review: review.nullable(),
  training_overlap: z.enum(["known_overlap", "declared_held_out", "unknown"]), note: z.string().max(20000),
}).strict().refine(r => r.verification !== "source_collated" || r.review !== null, "原画像との校合宣言には記録者付き記録が必要です");
export const ocrEvaluationSchema = z.object({ schema_version: z.literal("0.1"), evaluation_id: id, workspace_id: id,
  cases: z.array(z.object({ case_id: id, text_id: id, reference: reference.nullable(),
    variants: z.array(z.object({ variant_id: id, kind: z.enum(["image_reading", "image_assisted_correction"]),
      scope: z.literal("full_region"), text, text_sha256: ocrHashSchema, image_sha256: ocrHashSchema,
      generator: id, created_at: z.string().datetime(), duration_ms: z.number().finite().nonnegative().nullable(),
    }).strict()).max(2),
    observations: z.object({ author: id, recorded_at: z.string().datetime(), note: text,
      line_omission: z.enum(["unknown", "observed", "not_observed"]), reading_order: z.enum(["unknown", "observed", "not_observed"]),
      orthographic_change: z.enum(["unknown", "observed", "not_observed"]),
    }).strict().nullable(),
  }).strict()).min(1).max(80),
}).strict();

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
type Metrics = ReturnType<typeof compareOcrText>;
function aggregate(values: Metrics[], profile: keyof Metrics) {
  const sum = { reference_characters: 0, candidate_characters: 0, distance: 0, substitutions: 0, deletions: 0, insertions: 0, matched_characters: 0 };
  for (const value of values) for (const key of Object.keys(sum) as Array<keyof typeof sum>) sum[key] += value[profile][key];
  return { ...sum, cer: sum.reference_characters ? sum.distance / sum.reference_characters : null,
    precision: sum.candidate_characters ? sum.matched_characters / sum.candidate_characters : null,
    recall: sum.reference_characters ? sum.matched_characters / sum.reference_characters : null,
    f1: sum.reference_characters ? 2 * sum.matched_characters / (sum.reference_characters + sum.candidate_characters) : null };
}
export async function evaluateOcr(workspacePath: string, evaluationPath: string, outputPath: string, overwrite: boolean) {
  [workspacePath, evaluationPath, outputPath].forEach(p => ocrAbsoluteSchema.parse(p));
  const output = await canonical(outputPath);
  for (const input of [workspacePath, evaluationPath]) if (inside(await canonical(input), output))
    throw new Error("評価reportの保存先を入力と別にしてください");
  const workspaceBytes = await readOcrFile(workspacePath, 45 * 1024 * 1024);
  const evaluationBytes = await readOcrFile(evaluationPath, 8 * 1024 * 1024);
  const workspace = validateWorkspace(JSON.parse(workspaceBytes.toString("utf8").replace(/^\uFEFF/, "")));
  const evaluation = ocrEvaluationSchema.parse(JSON.parse(evaluationBytes.toString("utf8").replace(/^\uFEFF/, "")));
  if (evaluation.workspace_id !== workspace.workspace_id) throw new Error("評価workspaceが一致しません");
  const unique = (ids: string[]) => { if (new Set(ids).size !== ids.length) throw new Error("評価IDの重複があります"); };
  unique(evaluation.cases.map(c => c.case_id)); unique(evaluation.cases.map(c => c.text_id));
  const verifiedRuns = new Set<string>();
  const pages = new Set<string>(), regions = new Set<string>();
  const groups = new Map<string, { kind: string; verification: string; training_overlap: string; metrics: Metrics[] }>();
  const cases = [];
  for (const c of evaluation.cases) {
    const t = workspace.texts.find(t => t.text_id === c.text_id), p = t?.ocr_provenance;
    if (!t || !p) throw new Error("評価対象の原OCR候補がありません");
    assertOcrTarget(workspace, t);
    if (inside(await canonical(path.dirname(p.run_path)), output)) throw new Error("評価reportの保存先を原run・artifactの外にしてください");
    const runBytes = await readOcrFile(p.run_path, 32 * 1024 * 1024);
    if (ocrDigest(runBytes) !== p.run_sha256) throw new Error("評価対象の原run hashが一致しません");
    const run = ocrRunSchema.parse(JSON.parse(runBytes.toString("utf8").replace(/^\uFEFF/, "")));
    const item = run.items.find(item => item.source.evidence_id === p.source.evidence_id);
    if (!item || JSON.stringify([run.run_id, run.engine, run.evidence_sha256, item.source, item.lines, item.started_at, item.finished_at, item.duration_ms]) !==
      JSON.stringify([p.run_id, p.engine, p.evidence_sha256, p.source, p.lines, p.started_at, p.finished_at, p.duration_ms]))
      throw new Error("OCR provenanceと原runが一致しません");
    if (!verifiedRuns.has(p.run_path)) { await importOcr(workspace, p.run_path); verifiedRuns.add(p.run_path); }
    const evidence = JSON.parse((await readOcrFile(path.join(path.dirname(p.run_path), "evidence.json"))).toString("utf8").replace(/^\uFEFF/, ""));
    const originals = [run.evidence_path, ...evidence.items.filter((e: {display_image?: {path?: string}}) => e.display_image?.path)
      .map((e: {display_image: {path: string}}) => path.resolve(path.dirname(run.evidence_path), e.display_image.path))];
    for (const original of originals) if (inside(await canonical(original), output)) throw new Error("評価reportの保存先を原evidence・画像と別にしてください");
    if (inside(await canonical(p.engine.engine_dir), output)) throw new Error("評価reportの保存先をengineの外にしてください");
    if (c.reference && ocrDigest(c.reference.text) !== c.reference.text_sha256) throw new Error("参照翻刻の本文hashが一致しません");
    unique(c.variants.map(v => v.variant_id)); unique(c.variants.map(v => v.kind));
    for (const v of c.variants) if (v.image_sha256 !== p.source.image_sha256 || ocrDigest(v.text) !== v.text_sha256)
      throw new Error("読解候補の画像・本文hashが一致しません");
    const candidates = [{ candidate_id: t.text_id, kind: "ocr", text: t.text, text_sha256: t.source_sha256,
      generator: p.engine.provider, created_at: p.finished_at, duration_ms: p.duration_ms },
      ...c.variants.map(v => ({ candidate_id: v.variant_id, kind: v.kind, text: v.text, text_sha256: v.text_sha256,
        generator: v.generator, created_at: v.created_at, duration_ms: v.duration_ms }))].map(candidate => {
      const metrics = c.reference ? compareOcrText(c.reference.text, candidate.text) : null;
      if (metrics && c.reference) {
        const key = JSON.stringify([candidate.kind, c.reference.verification, c.reference.training_overlap]);
        const group = groups.get(key) ?? { kind: candidate.kind, verification: c.reference.verification, training_overlap: c.reference.training_overlap, metrics: [] };
        group.metrics.push(metrics); groups.set(key, group);
      }
      return { ...candidate, metrics, monetary_cost: null };
    });
    pages.add(JSON.stringify([p.source.document_id, p.source.manifest_sha256, p.source.selection.canvas_id]));
    regions.add(JSON.stringify([p.source.document_id, p.source.evidence_id]));
    cases.push({ case_id: c.case_id, state: c.reference ? "reference_agreement" : "pending_reference", source: p.source,
      run_path: p.run_path, run_sha256: p.run_sha256, engine: p.engine, reference: c.reference, observations: c.observations, candidates,
      unperformed_methods: ["image_reading", "image_assisted_correction"].filter(kind => !c.variants.some(v => v.kind === kind)) });
  }
  const summary = { cases: cases.length, canvases: pages.size, regions: regions.size,
    pending_reference: cases.filter(c => !c.reference).length,
    source_collated: cases.filter(c => c.reference?.verification === "source_collated").length,
    pending_observations: cases.filter(c => !c.observations).length };
  const report = { schema_version: "0.1", evaluation_id: evaluation.evaluation_id, generated_at: new Date().toISOString(),
    basis: "reference_agreement", image_transmission: "none",
    inputs: { workspace_path: workspacePath, workspace_sha256: ocrDigest(workspaceBytes), evaluation_path: evaluationPath, evaluation_sha256: ocrDigest(evaluationBytes) },
    policy: { strict: "raw Unicode code points", without_layout_whitespace: "NFC, then remove Unicode White_Space; no NFKC",
      edit_ties: "substitution, deletion, insertion", character_f1: "multiset intersection; ignores order",
      verification: "reference review and training overlap are input declarations; metrics do not verify them", monetary_cost: "not measured" },
    summary, cases, groups: [...groups.values()].map(({ metrics, ...group }) => ({ ...group, cases: metrics.length,
      strict: aggregate(metrics, "strict"), without_layout_whitespace: aggregate(metrics, "without_layout_whitespace") })) };
  await atomicWrite(outputPath, JSON.stringify(report, null, 2) + "\n", overwrite);
  return { report_path: outputPath, ...summary };
}
