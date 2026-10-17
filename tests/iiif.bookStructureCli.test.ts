import { afterEach,expect,it } from "vitest";
import { mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { runIiifCli } from "../src/iiif/cli.js";
import { structureFingerprint } from "../src/iiif/bookStructureSchemas.js";
import { makeBookRun } from "./fixtures/iiif/bookRun.js";
const dirs:string[]=[];afterEach(async()=>{for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});

it("runs build, review, TEI and real SQLite exports through the public local CLI",async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),"book-cli-"));dirs.push(dir);const f=await makeBookRun(dir);
  async function cli(request:any) {
    const file=path.join(dir,"request.json");await writeFile(file,JSON.stringify({api_version:"0.1",...request}));let stdout="";
    const code=await runIiifCli(["--request",file],{cwd:dir,stdout:s=>{stdout+=s;},stderr:()=>{}});
    return {code,...JSON.parse(stdout)};
  }
  const built=await cli({operation:"build_book_structure",workspace_path:f.workspacePath,text_ids:[f.textId],profile:"illustrated",output_dir:path.join(dir,"book")});
  expect(built.code,JSON.stringify(built)).toBe(0);const b=JSON.parse(await readFile(built.result.structure_path,"utf8")),field=b.units[0].fields[0];
  const reviewed=await cli({operation:"review_book_structure",structure_path:built.result.structure_path,expected_sha256:built.result.structure_sha256,output_dir:path.join(dir,"reviewed"),
    decisions:[{subject_id:field.field_id,subject_sha256:structureFingerprint(field),aspect:"transcription",result:"accepted",actor:{kind:"agent",name:"reviewer"},note:"確認範囲を記録"}]});
  expect(reviewed.code,JSON.stringify(reviewed)).toBe(0);
  const tei=await cli({operation:"export_book_structure",structure_path:reviewed.result.structure_path,expected_sha256:reviewed.result.structure_sha256,format:"tei",output_dir:path.join(dir,"tei")});
  expect(tei.code,JSON.stringify(tei)).toBe(0);expect(await readFile(tei.result.output_path,"utf8")).toContain("review-transcription-accepted-agent");
  const sqlite=await cli({operation:"export_book_structure",structure_path:reviewed.result.structure_path,expected_sha256:reviewed.result.structure_sha256,format:"sqlite",output_dir:path.join(dir,"sqlite")});
  expect(sqlite.code,JSON.stringify(sqlite)).toBe(0);
  const query=await promisify(execFile)("uv",["run","--quiet","--directory",path.resolve("packages/book-structure"),"--frozen","--inexact","--no-dev","python","-c",
    "import sqlite3,sys,json;db=sqlite3.connect(sys.argv[1]);print(json.dumps(db.execute('SELECT result,actor_kind FROM current_reviews').fetchall()));db.close()",sqlite.result.output_path],{windowsHide:true,timeout:60000});
  expect(JSON.parse(query.stdout)).toEqual([["accepted","agent"]]);
  const again=await cli({operation:"export_book_structure",structure_path:reviewed.result.structure_path,expected_sha256:reviewed.result.structure_sha256,format:"sqlite",output_dir:path.join(dir,"sqlite")});
  expect(again.ok).toBe(false);
},60000);
