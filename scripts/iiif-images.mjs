#!/usr/bin/env node
// 任意の画像解析環境をpackage外に置き、明示setupとoffline実行を分ける。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname,join,resolve } from "node:path";
import { fileURLToPath } from "node:url";
const project=resolve(dirname(fileURLToPath(import.meta.url)),"../packages/iiif-image-analysis");
const cache=process.env.XDG_CACHE_HOME??process.env.LOCALAPPDATA??join(homedir(),".cache");
const identity=createHash("sha256").update(project).digest("hex").slice(0,16);
const env={...process.env,UV_PROJECT_ENVIRONMENT:process.env.JP_LIT_IMAGE_ENVIRONMENT??join(cache,"jp-lit-mcp","iiif-images",identity),PYTHONDONTWRITEBYTECODE:"1"};
const args=process.argv.slice(2),setup=args.length===1&&args[0]==="--setup",test=args.length===1&&args[0]==="--test";
if(!setup&&!test&&(args.length!==2||args[0]!=="--request")){process.stdout.write(JSON.stringify({ok:false,error:"--setup / --test / --request <JSON path>を指定してください"}));process.exit(2);}
const uvArgs=setup?["sync","--frozen","--no-dev","--project",project]:["run","--offline","--quiet","--frozen","--no-dev","--project",project,"--directory",project,"python","-B",...(test?["-m","unittest","discover","-s","tests","-v"]:["-m","iiif_image","--request",resolve(args[1])])];
const child=spawnSync("uv",uvArgs,{env,shell:false,stdio:setup||test?"inherit":["ignore","pipe","pipe"],windowsHide:true,maxBuffer:2*1024*1024});
if(setup||test){process.exitCode=child.error?4:child.status??4;}
else {
 let valid=false;try{const response=JSON.parse(child.stdout?.toString("utf8"));valid=typeof response.ok==="boolean"&&(response.ok?child.status===0:child.status===4);}catch{}
 if(!valid||child.error||child.signal){process.stdout.write(JSON.stringify({ok:false,error:"uvとPython3.13を確認し、node scripts/iiif-images.mjs --setupで解析環境を準備してください。"}));process.exitCode=4;}
 else {process.stdout.write(child.stdout);process.exitCode=child.status;}
}
