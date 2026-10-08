import {it,expect,vi} from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {promisify} from "node:util";
const observed=vi.hoisted(()=>({env:undefined as NodeJS.ProcessEnv|undefined}));
vi.mock("node:child_process",async importOriginal=>{
 const actual=await importOriginal<typeof import("node:child_process")>();
 const wrapped=Object.assign((...args:any[])=>{observed.env=args[2].env;return (actual.execFile as any)(...args);},
  {[promisify.custom]:async(file:string,args:string[],options:any)=>{observed.env=options.env;return promisify(actual.execFile)(file,args,options);}});
 return {...actual,execFile:wrapped};
});
import {comparisonFixture} from "./fixtures/iiif/imageComparison.js";
import {compareImages} from "../src/iiif/imageComparison.js";
it("uses the same default cache context as explicit setup while withholding model credentials",async()=>{
 const root=await mkdtemp(path.join(tmpdir(),"image-env-"));
 try{
  const cache=path.join(root,"cache");vi.stubEnv("XDG_CACHE_HOME",cache);vi.stubEnv("LOCALAPPDATA",path.join(root,"local-cache"));vi.stubEnv("OPENAI_API_KEY","test-secret-not-to-forward");
  const f=await comparisonFixture(root);await compareImages(f.w,f.query,f.candidates,path.join(root,"result"));
  expect(observed.env?.XDG_CACHE_HOME).toBe(cache);expect(observed.env?.LOCALAPPDATA).toBe(path.join(root,"local-cache"));
  expect(observed.env?.OPENAI_API_KEY).toBeUndefined();
 }finally{vi.unstubAllEnvs();await rm(root,{recursive:true,force:true});}
},20000);
