import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import type { FetchedResource, ResourcePolicy } from './types.js';
import { imageDimensions } from './imageMetadata.js';

type Address = { address: string; family: number };
type Resolver = (host: string) => Promise<Address[]>;
type Response = { status: number; headers: Record<string,string | undefined>; body: AsyncIterable<Uint8Array>; cancel?: () => void };
type Transport = (url: URL, address: Address, signal: AbortSignal) => Promise<Response>;
const resolver: Resolver = host => lookup(host, { all: true, verbatim: true });
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && (b===168 || b===0 || (b===2 && c===0))) || (a===198 && (b===18 || b===19 || (b===51 && c===100))) || (a===203 && b===0 && c===113));
  }
  // IPv6はglobal unicastに絞り、移行用・文書用範囲も除く。
  if (isIP(address) === 6) { const a = address.toLowerCase(); return /^[23][0-9a-f]{3}:/.test(a) && !/^2001:(?:0{0,3}:|db8:)/.test(a) && !a.startsWith('2002:'); }
  return false;
}
export async function validatePublicUrl(value: string, resolve: Resolver = resolver) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || [...url.searchParams.keys()].some(k=>/token|secret|credential|password|signature|^sig$|auth|cookie|session|^key$|api.key/i.test(k))) throw new Error('公開HTTPS URLを指定してください');
  const host = url.hostname.replace(/^\[|\]$/g,'');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host);
  if (!addresses.length || addresses.some(a=>!isPublicAddress(a.address))) throw new Error('public宛以外の取得は扱いません');
  return { url, addresses };
}
const transport: Transport = (url, address, signal) => new Promise((resolve,reject) => {
  const options: https.RequestOptions & {autoSelectFamily:boolean} = { method:'GET', signal, agent:false, autoSelectFamily:false, family:address.family, headers:{Accept:'application/ld+json, application/json, image/jpeg, image/png', 'User-Agent':'jp-lit-iiif/0.1'}, lookup: (_host, _options, callback) => { callback(null,address.address,address.family); } };
  const req = https.request(url, options, res => {
    const headers = Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v]));
    resolve({status:res.statusCode??0,headers,body:res,cancel:()=>res.destroy()});
  });
  req.on('error',reject); req.end();
});
let pending: Promise<unknown> = Promise.resolve();
export function loadPublicResource(value: string, policy: ResourcePolicy, dependencies: { resolve?: Resolver; transport?: Transport } = {}): Promise<FetchedResource> {
  const operation = pending.then(()=>acquire(value,policy,dependencies));
  pending = operation.catch(()=>{}); return operation;
}
async function acquire(value: string, policy: ResourcePolicy, dependencies: { resolve?: Resolver; transport?: Transport }): Promise<FetchedResource> {
  if (!Number.isFinite(policy.max_bytes) || policy.max_bytes<=0 || !Number.isFinite(policy.timeout_ms) || policy.timeout_ms<=0 || !Number.isInteger(policy.max_redirects) || policy.max_redirects<0 || (policy.kind==='image' && (!policy.max_pixels || policy.max_pixels<=0))) throw new Error('取得上限が不正です');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_,reject)=>{ timer = setTimeout(()=>{controller.abort();reject(new Error('resource timeout'));},policy.timeout_ms); });
  const work = async () => {
    let current = value;
    for (let redirects=0;;redirects++) {
      const {url,addresses} = await validatePublicUrl(current,dependencies.resolve??resolver);
      if (controller.signal.aborted) throw new Error('resource timeout');
      const res = await (dependencies.transport??transport)(url,addresses[0],controller.signal);
      try {
        if ([301,302,303,307,308].includes(res.status)) { if (redirects>=policy.max_redirects || !res.headers.location) throw new Error('redirect上限または応答が不正です'); current = new URL(res.headers.location,url).href; continue; }
        if (res.status!==200) throw new Error(`resource HTTP ${res.status}`);
        const type = (res.headers['content-type']??'').split(';')[0].trim().toLowerCase();
        if (policy.kind==='json' ? !/^application\/(?:[a-z0-9.-]+\+)?json$/.test(type) : !['image/jpeg','image/png'].includes(type)) throw new Error('resource形式が未対応です');
        if (Number(res.headers['content-length'])>policy.max_bytes) throw new Error('resource容量が上限を超えます');
        const chunks: Uint8Array[] = []; let bytes=0;
        for await (const chunk of res.body) { if(controller.signal.aborted) throw new Error('resource timeout'); bytes+=chunk.byteLength; if(bytes>policy.max_bytes) throw new Error('resource容量が上限を超えます'); chunks.push(chunk); }
        const body = Buffer.concat(chunks);
        if(policy.kind==='json') JSON.parse(body.toString('utf8'));
        else { const dimensions=imageDimensions(body); if(dimensions.width*dimensions.height>policy.max_pixels!) throw new Error('image pixel上限を超えます'); }
        return {body,content_type:type,receipt:{requested_url:value,final_url:url.href,retrieved_at:new Date().toISOString(),sha256:createHash('sha256').update(body).digest('hex'),bytes}};
      } finally { res.cancel?.(); }
    }
  };
  try { return await Promise.race([work(),timeout]); } finally { clearTimeout(timer!); controller.abort(); }
}
