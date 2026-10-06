import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { ocrAbsoluteSchema, ocrGpuConfigSchema, ocrGpuEngineSchema, ocrHashSchema } from "./ocrSchemas.js";

const exec = promisify(execFile);
const host = process.platform === "win32" ? "npipe:////./pipe/docker_engine" : "unix:///var/run/docker.sock";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const environment = () => Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(systemroot|windir|path|temp|tmp|pathext|systemdrive)$/i.test(key)));
function command(docker: string, args: string[], timeout: number) {
  return exec(docker, ["--host",host,...args], {env:environment(),shell:false,windowsHide:true,timeout,killSignal:"SIGKILL",maxBuffer:2*1024*1024,encoding:"utf8"});
}
async function ownedContainer(docker: string, args: string[], timeout: number) {
  const name=`jp-lit-ocr-${randomUUID()}`;
  try {
    return await command(docker,["run","--rm","--pull","never","--name",name,"--network","none","--gpus","all",...args],timeout);
  } catch(error) {
    const e=error as Error & {killed?:boolean;signal?:unknown};
    if(e.killed || e.signal) {
      try {await command(docker,["container","rm","--force",name],15000);} catch {
        e.message += "; 所有GPU containerの停止が未確認です";
      }
    }
    throw e;
  }
}
const probe = `import hashlib,json,pathlib,sys,torch
root=pathlib.Path('/root/kotenocr_cli')
if not torch.cuda.is_available(): raise RuntimeError('CUDA GPU unavailable')
files=[]
for file in sorted(root.rglob('*')):
 if '.git' in file.parts or '__pycache__' in file.parts: continue
 if file.is_file() and file.suffix.lower() in ('.py','.yaml','.yml','.json','.pth','.bin','.joblib','.txt'):
  if file.is_symlink(): raise RuntimeError('Engine symbolic link unsupported')
  h=hashlib.sha256()
  with file.open('rb') as stream:
   for chunk in iter(lambda:stream.read(1024*1024),b''): h.update(chunk)
  files.append({'path':str(file.relative_to(root)),'sha256':h.hexdigest()})
  if len(files)>1000: raise RuntimeError('Engine file count exceeds limit')
print(json.dumps({'python_version':sys.version,'torch_version':torch.__version__,'cuda_version':torch.version.cuda,'gpu':torch.cuda.get_device_name(0),'files':files},sort_keys=False))
`;

// upstreamのbatch例外による行脱落を検出し、原engineを変更せず失敗と部分出力を保存する。
const wrapper = `import json,pathlib,runpy,sys,traceback
root=pathlib.Path('/root/kotenocr_cli')
sys.path.insert(0,str(root))
from src.text_kotenseki_recognition.text_recognition import TextRecognizer
original=TextRecognizer.predict
counts={'expected_lines':0,'returned_lines':0}
def checked(self,images,coords):
 result=original(self,images,coords)
 counts['expected_lines']+=len(images)
 counts['returned_lines']+=len(result)
 if len(images)!=len(coords) or len(result)!=len(images):
  raise RuntimeError('OCR silently dropped line batches: expected=%s returned=%s'%(len(images),len(result)))
 return result
TextRecognizer.predict=checked
image,out=sys.argv[1:3]
sys.argv=['main.py','infer',image,out,'-s','f','-a']
status='completed'
code=0
try:
 runpy.run_path(str(root/'main.py'),run_name='__main__')
except SystemExit as exc:
 code=int(exc.code or 0)
 if code: status='failed'
except Exception:
 traceback.print_exc()
 status='failed'
 code=1
with pathlib.Path('/out/gpu-validation.json').open('x',encoding='utf-8') as file:
 json.dump({'status':status,**counts},file)
sys.exit(code)
`;
export async function inspectGpuProvider(input: { provider:"ndlkotenocr-ver3"; docker_path:string; image_id:string }) {
  const parsed=z.object({provider:z.literal("ndlkotenocr-ver3"),docker_path:ocrAbsoluteSchema,image_id:z.string().regex(/^sha256:[a-f0-9]{64}$/)}).parse(input);
  const docker_path=await realpath(parsed.docker_path);
  if(!(await lstat(docker_path)).isFile())throw new Error("Docker実行fileを指定してください");
  const inspected=await command(docker_path,["image","inspect",parsed.image_id,"--format","{{.Id}}"],15000);
  if(inspected.stdout.trim()!==parsed.image_id)throw new Error("Docker image IDが一致しません");
  const raw=await ownedContainer(docker_path,["--env","PYTHONDONTWRITEBYTECODE=1","--entrypoint","python3",parsed.image_id,"-c",probe],60000);
  const metadata=z.object({python_version:z.string().min(1),torch_version:z.string().min(1),cuda_version:z.string().min(1),gpu:z.string().min(1),
    files:z.array(z.object({path:z.string().min(1).max(4096),sha256:ocrHashSchema}).strict()).min(1).max(1000)}).strict().parse(JSON.parse(raw.stdout));
  const names=metadata.files.map(f=>f.path);
  if(new Set(names).size!==names.length || names.some(name=>name.startsWith("/") || name.includes("\\") || name.split("/").some(p=>!p || p==="." || p==="..")))
    throw new Error("GPU engineのfile記録を確認してください");
  for(const name of ["main.py","config.yml","src/ndl_kotenseki_layout/models/ndl_kotenseki_layout_ver3.pth"])
    if(!names.includes(name))throw new Error(`GPU engine fileを確認してください: ${name}`);
  if(!names.some(name=>name.startsWith("src/text_kotenseki_recognition/") && name.endsWith(".bin")))throw new Error("GPU文字認識モデルを確認してください");
  const engine_sha256=digest(JSON.stringify({image_id:parsed.image_id,...metadata}));
  const engine=ocrGpuEngineSchema.parse({provider:parsed.provider,runtime:"docker",model_version:"3",docker_path,docker_host:host,image_id:parsed.image_id,engine_sha256,...metadata});
  return {engine,config:ocrGpuConfigSchema.parse({provider:parsed.provider,docker_path,image_id:parsed.image_id,expected_engine_sha256:engine_sha256})};
}
export async function runGpuImage(engine: z.infer<typeof ocrGpuEngineSchema>, imagePath: string, rawDir: string, timeoutMs: number) {
  const input=await realpath(imagePath), output=await realpath(rawDir);
  if([input,output].some(p=>/[,"\r\n]/.test(p)))throw new Error("Docker mountのpathにcomma・引用符・改行を含められません");
  const wrapperPath=path.join(output,"gpu-wrapper.py");
  await writeFile(wrapperPath,wrapper,{flag:"wx"});
  const imageName=path.basename(input);
  return ownedContainer(engine.docker_path,[
      "--env","HF_HUB_OFFLINE=1","--env","TRANSFORMERS_OFFLINE=1","--env","HF_DATASETS_OFFLINE=1","--env","PYTHONDONTWRITEBYTECODE=1",
      "--workdir","/root/kotenocr_cli","--entrypoint","python3",
      "--mount",`type=bind,source=${input},target=/input/${imageName},readonly`,
      "--mount",`type=bind,source=${output},target=/out`,
      "--mount",`type=bind,source=${wrapperPath},target=/run-wrapper.py,readonly`,
      engine.image_id,"/run-wrapper.py",`/input/${imageName}`,"/out/results"],timeoutMs);
}
export async function validateGpuCounts(rawDir: string, lineCount: number) {
  const file=path.join(rawDir,"gpu-validation.json"),stat=await lstat(file);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size>65536)throw new Error("GPU検証fileを確認してください");
  const validation=z.object({status:z.literal("completed"),expected_lines:z.number().int().nonnegative(),returned_lines:z.number().int().nonnegative()}).parse(JSON.parse(await readFile(file,"utf8")));
  if(validation.expected_lines!==validation.returned_lines || validation.returned_lines!==lineCount)
    throw new Error("GPU OCRの認識行数が一致しません");
}
