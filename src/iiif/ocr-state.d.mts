import type { IiifWorkspace, TextEvidence, ManifestDocument, CanvasInfo, RegionEvidence } from "./types.js";
import type { OcrSource } from "./ocrSchemas.js";

export function assertOcrTarget(workspace: IiifWorkspace, text: TextEvidence): {
  source: OcrSource;
  region: RegionEvidence;
  doc: ManifestDocument;
  canvas: CanvasInfo;
};
export function ocrMatchesRegion(workspace: IiifWorkspace, text: TextEvidence, regionId: string): boolean;
export function recordOcrReview(
  workspace: IiifWorkspace,
  textId: string,
  author: string,
  result: "match" | "mismatch" | "uncertain",
  note: string,
  correctedText?: string | null,
): void;
