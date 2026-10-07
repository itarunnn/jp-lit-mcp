import type { IiifWorkspace,RegionEvidence } from "./types.js";
import type { ImageComparisonRecord } from "./imageComparisonSchemas.js";
import type { OcrSource } from "./ocrSchemas.js";
export function assertComparisonSource(workspace:IiifWorkspace,source:OcrSource):{region:RegionEvidence;doc:IiifWorkspace["documents"][number];canvas:IiifWorkspace["documents"][number]["canvases"][number]};
export function mergeComparison(workspace:IiifWorkspace,record:ImageComparisonRecord,options?:{allow_stale?:boolean}):IiifWorkspace;
export function recordComparisonReview(workspace:IiifWorkspace,reportId:string,candidateId:string,input:{author:string;result:"match"|"mismatch"|"uncertain";note:string}):IiifWorkspace;
export function comparisonsForRegion(workspace:IiifWorkspace,region:RegionEvidence):Array<{report_id:string;report_path:string;report_sha256:string;algorithm:string;engine:ImageComparisonRecord["report"]["engine"];settings:ImageComparisonRecord["report"]["settings"];query:ImageComparisonRecord["report"]["query"];matches:ImageComparisonRecord["report"]["candidates"];reviews:ImageComparisonRecord["reviews"];verification_state:string}>;
