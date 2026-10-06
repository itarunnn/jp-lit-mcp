import type { IiifWorkspace, TextEvidence } from './types.js';
export const KURONET_VIEWER_URL: string;
export const KURONET_GUIDE_URL: string;
export function manualOcrSource(workspace: IiifWorkspace, regionId: string): {
  region: IiifWorkspace['regions'][number];
  doc: IiifWorkspace['documents'][number];
  canvas: IiifWorkspace['documents'][number]['canvases'][number];
  source: NonNullable<TextEvidence['manual_ocr_provenance']>['source'];
};
export function assertManualOcrTarget(workspace: IiifWorkspace, text: TextEvidence): ReturnType<typeof manualOcrSource>;
export function manualOcrMatchesRegion(workspace: IiifWorkspace, text: TextEvidence, regionId: string): boolean;
export function mergeManualOcrCandidate(workspace: IiifWorkspace, text: TextEvidence): {archived: boolean};
