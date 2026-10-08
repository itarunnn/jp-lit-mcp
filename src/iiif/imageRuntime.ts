import path from "node:path";
import {fileURLToPath} from "node:url";
import {lstat} from "node:fs/promises";

/** source checkoutと配布distで同じ同梱engineの保護対象を解決する。 */
export async function imageAnalysisProject():Promise<string>{
 for(const url of [new URL("../../packages/iiif-image-analysis/",import.meta.url),new URL("../../../packages/iiif-image-analysis/",import.meta.url)]){
  const project=fileURLToPath(url);
  try{if((await lstat(path.join(project,"pyproject.toml"))).isFile())return project;}
  catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 }
 throw Error("同梱の画像解析moduleを確認してください");
}
