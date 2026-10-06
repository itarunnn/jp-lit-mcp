import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { startLocalServer } from "../src/iiif/localServer.js";
import { saveWorkspace } from "../src/iiif/workspace.js";
import { sampleWorkspace } from "./fixtures/iiif/sample.js";
import { ocrCandidate } from "./fixtures/iiif/ocr.js";
import { importManualOcr } from '../src/iiif/manualOcr.js';
import { exportEvidence } from '../src/iiif/evidence.js';
import { validateWorkspace } from '../src/iiif/schemas.js';

function request(w: ReturnType<typeof sampleWorkspace>, text = "一二\n  □<script>三</script>\n") {
  return { provider: "kuronet", source: {
    workspace_id: w.workspace_id, document_id: "d1", manifest_sha256: "a".repeat(64),
    selection: structuredClone(w.regions[0].selection),
  }, text, author: "fixture-reader", result_url: "https://example.org/result", scope_confirmed: true };
}
async function withServer(run: (context: { w: ReturnType<typeof sampleWorkspace>; get: (route:string)=>Promise<Response>; post: (route: string, body: unknown, headers?: Record<string,string>) => Promise<Response>; saved: () => Promise<any> }) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), "iiif-manual-"));
  let server: Awaited<ReturnType<typeof startLocalServer>> | undefined;
  try {
    const assets = path.join(dir, "web"), file = path.join(dir, "workspace.json");
    await mkdir(assets);
    await copyFile(new URL('../packages/iiif-workbench/web/manual-ocr-panel.mjs',import.meta.url),path.join(assets,'manual-ocr-panel.mjs'));
    await copyFile(new URL('../src/iiif/manual-ocr-state.mjs',import.meta.url),path.join(assets,'manual-ocr-state.mjs'));
    const w = sampleWorkspace(); (w.texts as unknown[]).push(ocrCandidate());
    await saveWorkspace(file, w, false);
    server = await startLocalServer({ workspace_path: file, asset_root: assets });
    const url = new URL(server.url), headers = { "Content-Type": "application/json", Origin: url.origin, "x-iiif-token": url.hash.slice(1) };
    await run({ w, get:route=>fetch(url.origin+route), post: (route, body, overrides = {}) => fetch(url.origin + route, { method: "POST", headers: { ...headers, ...overrides }, body: JSON.stringify(body) }), saved: async () => JSON.parse(await readFile(file, "utf8")) });
  } finally {
    await server?.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error("Unexpected test directory");
    await rm(dir, { recursive: true, force: true });
  }
}

describe("manual KuroNet OCR import", () => {
  it('serves both shared browser modules through the fixed static allowlist',async()=>{
    await withServer(async({get})=>{
      for(const file of ['manual-ocr-panel.mjs','manual-ocr-state.mjs']){
        const response=await get('/'+file);expect(response.status).toBe(200);expect(response.headers.get('Content-Type')).toContain('javascript');
        const source=new URL(file==='manual-ocr-panel.mjs'?'../packages/iiif-workbench/web/'+file:'../src/iiif/'+file,import.meta.url);
        expect(await response.text()).toBe(await readFile(source,'utf8'));
      }
    });
  });
  it('uses the selected window document when another document has the same Canvas ID',()=>{
    const w:any=sampleWorkspace(), other=structuredClone(w.documents[0]);
    other.document_id='d2';other.receipt.sha256='b'.repeat(64);other.canvases[0].width=200;w.documents.unshift(other);
    const result=importManualOcr(validateWorkspace(w),request(w));
    expect(result.text.manual_ocr_provenance!.source.document_id).toBe('d1');
    expect(result.text.manual_ocr_provenance!.source.manifest_sha256).toBe('a'.repeat(64));
  });
  it('includes raw text and manual provenance in a reading export without external requests',async()=>{
    const dir=await mkdtemp(path.join(tmpdir(),'manual-export-'));
    try{
      const w=sampleWorkspace(), result=importManualOcr(validateWorkspace(w),request(w)), file=path.join(dir,'workspace.json');
      await saveWorkspace(file,result.workspace,false);
      const output=await exportEvidence({api_version:'0.1',operation:'export_evidence',workspace_path:file,region_ids:['r1'],output_dir:path.join(dir,'reading'),overwrite:false,image_permission_confirmed:false},async()=>{throw Error('Unexpected external request');});
      const evidence=JSON.parse(await readFile(output.evidence_json_path,'utf8'));
      expect(evidence.items[0].text_evidence[0]).toEqual(result.text);
      expect(await readFile(output.text_paths[0],'utf8')).toContain(result.text.text);
    }finally{if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unexpected directory');await rm(dir,{recursive:true,force:true});}
  });
  it("persists raw pasted text with separate provenance and preserves the original OCR on reimport", async () => {
    await withServer(async ({ w, post, saved }) => {
      const original = (await saved()).texts[0], input = request(w);
      const response = await post("/api/ocr/manual", input);
      expect(response.status).toBe(200);
      const first = await response.json();
      expect(first.imported).toBe(true);
      expect(first.text).toMatchObject({ text: input.text, origin: "ocr_candidate", verification_state: "unverified",
        source_sha256: createHash("sha256").update(input.text).digest("hex"),
        manual_ocr_provenance: { provider: "kuronet", acquisition: "manual_copy", author: "fixture-reader", result_url: input.result_url, model_version: null, source_image_sha256: null, scope_verification: "user_declared", source: input.source } });
      expect(first.text.ocr_provenance).toBeUndefined();
      const persisted = await saved();
      expect(persisted.texts[0]).toEqual(original);
      expect(persisted.texts[1]).toEqual(first.text);
      expect(persisted.regions[0].text_evidence_ids).toContain(first.text.text_id);
      const again = await (await post("/api/ocr/manual", input)).json();
      expect(again.imported).toBe(false);
      expect(again.text).toEqual(first.text);
      expect((await saved()).texts).toHaveLength(2);
    });
  });

  it.each(["workspace", "document", "manifest", "canvas", "rectangle", "window"])("rejects a changed %s target without modifying the workspace", async (field) => {
    await withServer(async ({ w, post, saved }) => {
      const before = await saved(), input = request(w);
      if (field === "workspace") input.source.workspace_id = "other";
      if (field === "document") input.source.document_id = "other";
      if (field === "manifest") input.source.manifest_sha256 = "b".repeat(64);
      if (field === "canvas") input.source.selection.canvas_id = "https://example.org/c2";
      if (field === "rectangle") input.source.selection.xywh[0] = 101;
      if (field === "window") input.source.selection.window_id = "other";
      expect((await post("/api/ocr/manual", input)).status).toBe(400);
      expect(await saved()).toEqual(before);
    });
  });

  it.each(["empty", "whitespace", "unconfirmed", "javascript", "credentials", "wrong-provider"])("rejects %s input without adding a candidate", async (kind) => {
    await withServer(async ({ w, post, saved }) => {
      const before = await saved(), input: any = request(w);
      if (kind === "empty") input.text = "";
      if (kind === "whitespace") input.text = " \n\t";
      if (kind === "unconfirmed") input.scope_confirmed = false;
      if (kind === "javascript") input.result_url = "javascript:alert(1)";
      if (kind === "credentials") input.result_url = "https://user:password@example.org/result";
      if (kind === "wrong-provider") input.provider = "ndlkotenocr-lite";
      expect((await post("/api/ocr/manual", input)).status).toBe(400);
      expect(await saved()).toEqual(before);
    });
  });

  it("rejects a tampered manual body and verified status when loading a saved workspace", async () => {
    await withServer(async ({ w, post, saved }) => {
      expect((await post("/api/ocr/manual", request(w))).status).toBe(200);
      const before = await saved(), changed = structuredClone(before);
      changed.texts[1].text = "別の本文";
      expect((await post("/api/workspace", changed)).status).toBe(400);
      const promoted = structuredClone(before); promoted.texts[1].verification_state = "human_verified";
      expect((await post("/api/workspace", promoted)).status).toBe(400);
      expect(await saved()).toEqual(before);
    });
  });

  it("requires the local token and Origin for manual import", async () => {
    await withServer(async ({ w, post, saved }) => {
      const before = await saved();
      expect((await post("/api/ocr/manual", request(w), { "x-iiif-token": "wrong" })).status).toBe(403);
      expect((await post("/api/ocr/manual", request(w), { Origin: "https://example.org" })).status).toBe(403);
      expect(await saved()).toEqual(before);
    });
  });
  it('keeps detached history and rejects a generic import that overwrites a manual original', async () => {
    await withServer(async ({w,post,saved})=>{
      const first=await (await post('/api/ocr/manual',request(w))).json();
      const input={document_id:'d1',canvas_id:first.text.canvas_id,text:{...first.text,text:'上書き候補'}};
      delete input.text.manual_ocr_provenance;
      expect((await post('/api/text/import',input)).status).toBe(400);
      const before=await saved();expect(before.texts[1]).toEqual(first.text);
      before.regions=[];
      expect((await post('/api/workspace',before)).status).toBe(200);
      expect((await saved()).texts[1]).toEqual(first.text);
    });
  });
});
