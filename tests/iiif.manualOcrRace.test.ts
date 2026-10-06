import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {sampleWorkspace} from './fixtures/iiif/sample.js';
import {validateWorkspace} from '../src/iiif/schemas.js';
import {importManualOcr} from '../src/iiif/manualOcr.js';

it('retains a saved candidate when its region is deleted during the response and blocks workspace replacement',async()=>{
  const app=await readFile('packages/iiif-workbench/web/app.mjs','utf8');
  const callback=app.match(/async importCandidate\(input\) \{([\s\S]*?)\n    \},\n    openImage/)![1];
  const fileAction=app.slice(app.indexOf('function fileAction('),app.indexOf('fileAction("import-workspace"'));
  const state=await import(pathToFileURL(path.resolve('src/iiif/manual-ocr-state.mjs')).href);
  let server=validateWorkspace(sampleWorkspace()), release!:()=>void, entered!:()=>void;
  const waiting=new Promise<void>(r=>{entered=r;}), gate=new Promise<void>(r=>{release=r;});
  const messages:string[]=[],element:any={files:[{size:20,text:async()=>JSON.stringify({workspace_id:'other'})}],value:'selected-file'};
  const make=new Function('deps',`let workspace=deps.workspace,manualImportBusy=false;const {api,assertManualOcrTarget,mergeManualOcrCandidate,renderTexts,$,status}=deps;
    const snapshot=()=>workspace;
    ${fileAction}
    fileAction('import-workspace',async value=>{workspace=value;});
    return {run:async function(input){${callback}},getWorkspace:()=>workspace};`);
  const ui=make({workspace:validateWorkspace(sampleWorkspace()),...state,renderTexts:()=>{},$:()=>element,status:(s:string)=>messages.push(s),
    api:async(route:string,body:any)=>{
      if(route==='/api/workspace'){server=validateWorkspace(structuredClone(body));return server;}
      const result=importManualOcr(server,body);server=result.workspace;entered();await gate;return result;
    }});
  const w=ui.getWorkspace(), request={provider:'kuronet',source:{workspace_id:'w1',document_id:'d1',manifest_sha256:'a'.repeat(64),selection:structuredClone(w.regions[0].selection)},text:'原出力',author:'race-fixture',scope_confirmed:true};
  const pending=ui.run(request).catch((e:Error)=>{messages.push(e.message);});await waiting;
  w.regions=[];await element.onchange();release();await pending;
  const client=ui.getWorkspace();expect(client.workspace_id).toBe('w1');expect(client.texts).toHaveLength(1);
  expect(client.texts[0].text).toBe('原出力');expect(server.texts[0]).toEqual(client.texts[0]);
  server=validateWorkspace(structuredClone(client));expect(server.texts).toHaveLength(1);
  expect(messages.some(s=>/保存中/.test(s))).toBe(true);
});
