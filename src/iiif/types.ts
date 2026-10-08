import type { z } from "zod";
import type {
  candidateSchema,
  receiptSchema,
  documentSchema,
  canvasSchema,
  windowSchema,
  selectionSchema,
  regionSchema,
  textSchema,
  workspaceSchema,
  requestSchema,
  viewerSchema,
  languageSchema,
} from "./schemas.js";
export type ManifestCandidate = z.infer<typeof candidateSchema>;
export type ResourceReceipt = z.infer<typeof receiptSchema>;
export type ManifestDocument = z.infer<typeof documentSchema>;
export type CanvasInfo = z.infer<typeof canvasSchema>;
export type WindowSelection = z.infer<typeof windowSchema>;
export type RegionSelection = z.infer<typeof selectionSchema>;
export type RegionEvidence = z.infer<typeof regionSchema>;
export type TextEvidence = z.infer<typeof textSchema>;
export type IiifWorkspace = z.infer<typeof workspaceSchema>;
export type IiifRequest = z.infer<typeof requestSchema>;
export type ExportEvidenceRequest = Extract<
  IiifRequest,
  { operation: "export_evidence" }
>;
export type ViewerState = z.infer<typeof viewerSchema>;
export type LanguageText = z.infer<typeof languageSchema>;
export interface ResourcePolicy {
  max_bytes: number;
  timeout_ms: number;
  max_redirects: number;
  kind: "json" | "image";
  max_pixels?: number;
}
export interface FetchedResource {
  body: Uint8Array;
  content_type: string;
  receipt: ResourceReceipt;
}
export interface ImageServiceInfo {
  service_id: string;
  version: "2" | "3";
  width: number;
  height: number;
  profile: unknown;
  rights: unknown[];
  receipt: ResourceReceipt;
}
export interface CropResult {
  status: "supported" | "unsupported";
  image_url: string | null;
  image_xywh: [number, number, number, number] | null;
  transform: {
    scale_x: number;
    scale_y: number;
    display_max_edge: number;
  } | null;
  diagnostics: string[];
}
export interface EvidenceExport {
  evidence_json_path: string;
  prompt_path: string;
  image_paths: string[];
  text_paths: string[];
  tei_paths: string[];
  diagnostics: string[];
}
export interface LocalServerOptions {
  workspace_path: string;
  asset_root: string;
}
export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  cwd: string;
}
