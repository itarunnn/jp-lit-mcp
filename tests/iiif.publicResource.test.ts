import { describe, expect, it } from 'vitest';
import { loadPublicResource, validatePublicUrl } from '../src/iiif/publicResource.js';
const policy = {max_bytes:20,timeout_ms:50,max_redirects:3,kind:'json' as const};
const resolve = async () => [{address:'8.8.8.8',family:4}];
function transport(status:number, headers:Record<string,string>, chunks:string[]) { return async () => ({status,headers,body:(async function*(){for(const s of chunks) yield Buffer.from(s);})()}); }
describe('bounded public IIIF resource acquisition', () => {
  it('rejects private addresses, mixed DNS, credentials and auth URLs before transport', async () => {
    for (const url of ['http://example.org/m','https://127.0.0.1/m','https://[::1]/m','https://user:pw@example.org/m','https://example.org/m?token=secret']) await expect(validatePublicUrl(url,resolve)).rejects.toThrow();
    await expect(validatePublicUrl('https://example.org/m',async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}])).rejects.toThrow();
  });
  it('hashes received bytes and rejects HTML and streamed oversized resources', async () => {
    const r = await loadPublicResource('https://example.org/m',policy,{resolve,transport:transport(200,{'content-type':'application/json'},['{}'])});
    expect(r.receipt.sha256).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
    await expect(loadPublicResource('https://example.org/m',policy,{resolve,transport:transport(200,{'content-type':'text/html'},['<html>'])})).rejects.toThrow();
    await expect(loadPublicResource('https://example.org/m',policy,{resolve,transport:transport(200,{'content-type':'application/json'},['a'.repeat(15),'b'.repeat(15)])})).rejects.toThrow();
  });
  it('validates each redirect and enforces the redirect count', async () => {
    await expect(loadPublicResource('https://example.org/m',policy,{resolve,transport:transport(302,{location:'https://10.0.0.1/m'},[])})).rejects.toThrow();
    await expect(loadPublicResource('https://example.org/m',policy,{resolve,transport:transport(302,{location:'/again'},[])})).rejects.toThrow(/redirect/);
  });
  it('times out while waiting for the body', async () => {
    await expect(loadPublicResource('https://example.org/m',policy,{resolve,transport:async()=>({status:200,headers:{'content-type':'application/json'},body:(async function*(){await new Promise(r=>setTimeout(r,100));yield Buffer.from('{}');})()})})).rejects.toThrow(/timeout/);
  });
});
