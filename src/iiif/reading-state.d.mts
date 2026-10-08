import type { IiifWorkspace, TextEvidence, ManifestDocument, CanvasInfo, RegionEvidence } from "./types.js";
import type { OcrSource } from "./ocrSchemas.js";
export function assertReadingTarget(workspace:IiifWorkspace,text:TextEvidence):{source:OcrSource,region:RegionEvidence,doc:ManifestDocument,canvas:CanvasInfo};
export function readingMatchesRegion(workspace:IiifWorkspace,text:TextEvidence,regionId:string):boolean;
export function recordReadingReview(workspace:IiifWorkspace,textId:string,input:{reviewer_type:"human"|"ai",author:string,result:"match"|"mismatch"|"uncertain",note:string,corrected_text:string|null}):IiifWorkspace;
