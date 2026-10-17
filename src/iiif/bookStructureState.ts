import { structureFingerprint, type BookStructure } from "./bookStructureSchemas.js";

/** 失効した確認を除き、確認者・観点ごとの現在値を返す。履歴本体は保持する。 */
export function currentBookReviews(b: BookStructure, subjectId?: string, value?: unknown) {
  const invalidated = new Set(b.revisions.flatMap(r => (r.payload.invalidated_review_ids ?? []) as string[]));
  const latest = new Map<string, BookStructure["reviews"][number]>();
  for (const r of b.reviews) if (subjectId === undefined || r.subject_id === subjectId) {
    latest.set(JSON.stringify([r.subject_id, r.aspect, r.actor.kind, r.actor.name]), r);
  }
  return [...latest.values()].filter(r => !invalidated.has(r.review_id) && (value === undefined || r.subject_sha256 === structureFingerprint(value)));
}

/** 人の確認があればその記録を優先し、競合と再確認は確定表示を保留する。 */
export function acceptedBookAssociation(b: BookStructure, relation: BookStructure["relations"][number]) {
  const reviews = currentBookReviews(b, relation.relation_id, relation).filter(r => r.aspect === "association");
  const human = reviews.filter(r => r.actor.kind === "human"), authoritative = human.length ? human : reviews;
  return authoritative.length > 0 && authoritative.every(r => r.result === "accepted");
}
