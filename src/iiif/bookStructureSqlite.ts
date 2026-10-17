import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function bookStructureProject():Promise<string> {
  for(const url of [new URL("../../packages/book-structure/",import.meta.url),new URL("../../../packages/book-structure/",import.meta.url)]) {
    const root=fileURLToPath(url);try{await access(path.join(root,"pyproject.toml"));return root;}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  }
  throw Error("同梱の書籍構造Python moduleを確認してください");
}
export async function exportBookSqlite(structurePath:string,outputPath:string):Promise<void> {
  const root=await bookStructureProject();
  await new Promise<void>((resolve,reject)=>{
    const child=spawn("uv",["run","--quiet","--directory",root,"--frozen","--no-dev","python","-m","book_structure","sqlite","--input",structurePath,"--output",outputPath],
      {shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    let bytes=0,settled=false;const chunks:Buffer[]=[];
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolve();};
    const timer=setTimeout(()=>finish(Error("SQLite出力の処理時間が上限を超えました")),60000);
    child.on("error",()=>finish(Error("SQLite出力にはuvと同梱Python環境が必要です")));
    for(const stream of [child.stdout,child.stderr])stream.on("data",(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>1024*1024)finish(Error("SQLite出力の応答容量が上限を超えました"));});
    child.stdout.on("data",(chunk:Buffer)=>chunks.push(chunk));
    child.on("close",code=>{if(code!==0)finish(Error("SQLite出力に失敗しました。Python環境と入力を確認してください"));else{try{if(!JSON.parse(Buffer.concat(chunks).toString("utf8")).ok)throw Error();finish();}catch{finish(Error("SQLite出力の応答が不正です"));}}});
  });
}
