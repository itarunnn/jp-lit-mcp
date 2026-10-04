import { describe, expect, it } from 'vitest';
import { normalizeManifest } from '../src/iiif/manifest.js';
import { extractManifestCandidates } from '../src/iiif/candidates.js';
import { collectText } from '../src/iiif/text.js';
import { sampleWorkspace } from './fixtures/iiif/sample.js';
const receipt = sampleWorkspace().documents[0].receipt;
const c = { '@id':'https://example.org/c', '@type':'sc:Canvas', label:'同じ頁', width:1000, height:2000, images:[{on:'https://example.org/c',resource:{'@id':'https://example.org/i/full/full/0/default.jpg','@type':'dctypes:Image',width:2000,height:4000,service:{'@id':'https://example.org/i','@context':'http://iiif.io/api/image/2/context.json',profile:'http://iiif.io/api/image/2/level2.json'}}}] };
describe('IIIF manifest inspection', () => {
  it('retains Japanese labels, sequence choice, page IDs, scaled image dimensions and rights hierarchy', () => {
    const m = normalizeManifest({'@id':'https://example.org/m','@type':'sc:Manifest',label:[{'@language':'ja','@value':'原題'}],license:'https://example.org/license',attribution:'原提供元',sequences:[{'@id':'s1',canvases:[c]},{'@id':'s2',canvases:[{...c,'@id':'https://example.org/c2'}]}]},receipt,'s2');
    expect(m.selected_sequence_id).toBe('s2'); expect(m.canvases[0].canvas_id).toBe('https://example.org/c2');
    expect(m.label).toEqual([{language:'ja',values:['原題']}]); expect(m.canvases[0].images[0].width).toBe(2000);
    expect(m.rights).toContainEqual({scope:'manifest',field:'attribution',value:'原提供元'});
  });
  it('distinguishes v3 painting from existing text and keeps the text target', () => {
    const m = normalizeManifest({id:'https://example.org/m',type:'Manifest',label:{ja:['資料'],en:['Book']},items:[{id:'https://example.org/c',type:'Canvas',width:1000,height:2000,items:[{type:'AnnotationPage',items:[{id:'a',type:'Annotation',motivation:'painting',target:'https://example.org/c',body:{id:'https://example.org/image.jpg',type:'Image',width:1000,height:2000}}]}],annotations:[{id:'txt',type:'AnnotationPage',items:[{id:'t1',type:'Annotation',target:'https://example.org/c#xywh=10,20,30,40',body:{type:'TextualBody',value:'旧字體'}}]}]}]},receipt);
    expect(m.canvases[0].images).toHaveLength(1);
    expect(collectText(m.canvases[0].text_refs[0],m.canvases[0].canvas_id,receipt.sha256)[0]).toMatchObject({text:'旧字體',target_xywh:[10,20,30,40],verification_state:'provider_text'});
  });
  it('rejects unsupported collections, absent sequences and oversized selected sequences', () => {
    expect(() => normalizeManifest({type:'Collection'},receipt)).toThrow();
    expect(() => normalizeManifest({'@type':'sc:Manifest',sequences:[{'@id':'s',canvases:[c]}]},receipt,'missing')).toThrow();
    expect(() => normalizeManifest({'@id':'m','@type':'sc:Manifest',sequences:[{canvases:Array(2001).fill(c)}]},receipt)).toThrow();
  });
  it('extracts provider candidates without fetching and marks NDL-derived URLs as candidates', () => {
    const records = [{source:'kokusho',source_id:'1',url:'https://example.org/b',source_metadata:{manifest_url:'https://example.org/m'},identifiers:{}},{source:'japan_search',source_id:'2',url:null,source_metadata:{iiif_url:'https://example.org/m2'},identifiers:{}},{source:'ndl_search',source_id:'3',url:null,source_metadata:{},identifiers:{ndljp:'3048007'}}];
    expect(extractManifestCandidates(records as any).map(x=>[x.acquisition,x.verification_state])).toEqual([['provider_metadata','candidate'],['provider_metadata','candidate'],['derived_from_pid','candidate']]);
  });
});
