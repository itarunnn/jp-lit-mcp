import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";

export const modalProjectRoot=()=>{
  const parent=fileURLToPath(new URL("../../",import.meta.url));
  return path.basename(path.normalize(parent))==="dist"?path.dirname(path.normalize(parent)):parent;
};
export async function modalBridge(payload:unknown){
  const control=await mkdtemp(path.join(tmpdir(),"jp-lit-modal-"));
  const cancelPath=path.join(control,"cancel");
  return new Promise<{response:unknown;stderr:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(modalProjectRoot(),"scripts/iiif-ocr-modal.mjs")],{shell:false,windowsHide:true,detached:process.platform!=="win32",
      env:{...process.env,JP_LIT_MODAL_CANCEL_PATH:cancelPath},stdio:["pipe","pipe","pipe"]});
    const out:Buffer[]=[],err:Buffer[]=[];let size=0,errors=0,settled=false,failure:string|null=null,grace:NodeJS.Timeout|undefined;
    const evidence=(message:string)=>Object.assign(new Error(message),{stdout:Buffer.concat(out).toString("utf8"),stderr:Buffer.concat(err).toString("utf8")});
    const cleanup=()=>{clearTimeout(timer);clearTimeout(grace);void rm(control,{recursive:true,force:true});};
    const finishFailure=()=>{if(settled)return;settled=true;cleanup();reject(evidence(failure!));};
    const fail=(message:string)=>{
      if(settled||failure)return;failure=message;clearTimeout(timer);
      // SDKに所有callのcancelを依頼し、確認logと通常終了を待つ。
      void writeFile(cancelPath,"cancel\n").catch(()=>{});
      grace=setTimeout(()=>{
        if(child.pid){
          if(process.platform==="win32"){
            // 起動したhelper PIDとその子だけを回収する。shellは介さない。
            const stop=spawn("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{shell:false,windowsHide:true,stdio:"ignore"});
            stop.on("error",finishFailure);stop.on("close",finishFailure);
          } else {try{process.kill(-child.pid,"SIGKILL");}catch{}finishFailure();}
        } else finishFailure();
      },15000);
    };
    // remoteは別に780秒で終了する。buildとstartupを含めたhost待機にも上限を置く。
    const timer=setTimeout(()=>fail("Modal bridgeの待機時間を超えました。保存した実行IDを確認してください"),2400000);
    child.on("error",()=>fail("Modal bridgeを起動できません"));
    child.stdin.on("error",()=>fail("Modal bridgeへ要求を渡せません"));
    child.stdout.on("data",(b:Buffer)=>{const room=16*1024*1024-size;if(room>0)out.push(b.subarray(0,room));size+=b.length;if(size>16*1024*1024)fail("Modal原応答の容量上限です");});
    child.stderr.on("data",(b:Buffer)=>{
      err.push(b);errors+=b.length;
      // 大きいbuild logの末尾に出る実行ID・cancel確認を容量内に保つ。
      while(errors>2*1024*1024){
        const first=err[0],excess=errors-2*1024*1024;
        if(first.length<=excess){err.shift();errors-=first.length;}
        else{err[0]=first.subarray(excess);errors-=excess;}
      }
    });
    child.on("close",()=>{
      if(settled)return;if(failure){finishFailure();return;}settled=true;cleanup();
      try {resolve({response:JSON.parse(Buffer.concat(out).toString("utf8")),stderr:Buffer.concat(err).toString("utf8")});}
      catch{reject(evidence("Modal bridgeの応答を確認できません。認証とruntimeのlogを確認してください"));}
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
