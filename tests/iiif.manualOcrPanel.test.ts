import { expect, it, vi } from 'vitest';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { sampleWorkspace } from './fixtures/iiif/sample.js';
import { importManualOcr } from '../src/iiif/manualOcr.js';
import { validateWorkspace } from '../src/iiif/schemas.js';
class Element {
  children:Element[]=[]; textContent=''; value=''; checked=false; disabled=false; dataset:Record<string,string>={};
  onclick?:()=>Promise<void>|void; onchange?:()=>void; placeholder=''; href=''; target=''; rel=''; open=false;
  constructor(public tag:string){}
  append(...children:Element[]){this.children.push(...children);}
  replaceChildren(...children:Element[]){this.children=children;}
  setAttribute(){} scrollIntoView(){}
}
function find(root:Element,predicate:(e:Element)=>boolean):Element|undefined {
  if(predicate(root)) return root;
  for(const child of root.children){const result=find(child,predicate);if(result)return result;}
}
async function setup(run:(ctx:any)=>Promise<void>) {
  const dir=await mkdtemp(path.join(tmpdir(),'manual-panel-'));
  try {
    await copyFile(new URL('../packages/iiif-workbench/web/manual-ocr-panel.mjs',import.meta.url),path.join(dir,'manual-ocr-panel.mjs'));
    await copyFile(new URL('../src/iiif/manual-ocr-state.mjs',import.meta.url),path.join(dir,'manual-ocr-state.mjs'));
    const {createManualOcrPanel}=await import(/* @vite-ignore */pathToFileURL(path.join(dir,'manual-ocr-panel.mjs')).href);
    vi.stubGlobal('document',{createElement:(tag:string)=>new Element(tag)});
    let w=validateWorkspace(sampleWorkspace()); const element=new Element('section'), messages:string[]=[], images:any[]=[];
    const panel=createManualOcrPanel({element,workspace:()=>w,status:(s:string)=>messages.push(s),
      importCandidate:async(input:unknown)=>{const result=importManualOcr(w,input);w=result.workspace;return result;},
      openImage:(t:unknown)=>images.push(t)});
    panel.render();
    await run({element,panel,workspace:()=>w,messages,images});
  } finally {vi.unstubAllGlobals();if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unexpected directory');await rm(dir,{recursive:true,force:true});}
}
it('opens a fixed official URL and preserves a raw manual result with region provenance',async()=>{
  await setup(async({element,panel,workspace,images}:any)=>{
    panel.showRegion(workspace().regions[0]);
    const link=find(element,e=>e.tag==='a'&&e.textContent==='KuroNetを開く')!;
    expect(link.href).toBe('https://codh.rois.ac.jp/kuronet/iiif-curation-viewer/');
    expect(link.target).toBe('_blank'); expect(link.rel).toMatch(/noopener/);
    expect(find(element,e=>e.tag==='input'&&e.value==='https://example.org/m')).toBeDefined();
    find(element,e=>e.placeholder==='KuroNetで取り出した本文')!.value='一\n  □<script>二</script>\n';
    find(element,e=>e.placeholder==='取込の記録者')!.value='reader';
    find(element,e=>e.tag==='input'&&e.value==='confirm-scope')!.checked=true;
    await find(element,e=>e.tag==='button'&&e.textContent==='OCR候補を保存')!.onclick!();
    const t=workspace().texts[0];
    expect(t.text).toBe('一\n  □<script>二</script>\n');
    expect(t.verification_state).toBe('unverified'); expect(t.manual_ocr_provenance.source.document_id).toBe('d1');
    expect(find(element,e=>e.tag==='pre'&&e.textContent===t.text)).toBeDefined();
    find(element,e=>e.tag==='button'&&e.textContent==='原画像の領域へ')!.onclick!();
    expect(images[0].text_id).toBe(t.text_id);
    workspace().regions=[];panel.render();
    expect(find(element,e=>e.tag==='pre'&&e.textContent===t.text)).toBeDefined();
    expect(find(element,e=>e.tag==='button'&&e.textContent==='原画像の領域へ')!.disabled).toBe(true);
  });
});
it('invalidates the scope declaration on source change while retaining the pasted draft',async()=>{
  await setup(async({element,panel,workspace,messages}:any)=>{
    panel.showRegion(workspace().regions[0]);
    const body=find(element,e=>e.placeholder==='KuroNetで取り出した本文')!;body.value='原出力';
    find(element,e=>e.placeholder==='取込の記録者')!.value='reader';
    const confirm=find(element,e=>e.tag==='input'&&e.value==='confirm-scope')!;confirm.checked=true;
    workspace().regions[0].selection.xywh[0]++;panel.render();
    expect(confirm.checked).toBe(false);expect(body.value).toBe('原出力');
    await find(element,e=>e.tag==='button'&&e.textContent==='OCR候補を保存')!.onclick!();
    expect(workspace().texts).toHaveLength(0);expect(messages.at(-1)).toMatch(/対応/);
  });
});
