import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const adapter=await import(pathToFileURL(path.resolve('packages/iiif-workbench/web/viewer-adapter.mjs')).href);
describe('saved IIIF comparison layout',()=>{
  it('accepts a complete split layout and rejects hidden, duplicate or unknown windows',()=>{
    expect(adapter.validLayout({direction:'row',first:'w1',second:'w2',splitPercentage:37},['w1','w2'])).toBe(true);
    expect(adapter.validLayout({direction:'row',first:'w1',second:'w1'},['w1','w2'])).toBe(false);
    expect(adapter.validLayout('w1',['w1','w2'])).toBe(false);
    expect(adapter.validLayout({direction:'column',first:'w1',second:'evil',splitPercentage:Infinity},['w1','w2'])).toBe(false);
  });
});
