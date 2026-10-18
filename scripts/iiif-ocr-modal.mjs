#!/usr/bin/env node
// 利用者が選択したModal実行だけにPython SDKを用意する。
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/iiif-ocr-modal");
const cache = process.env.XDG_CACHE_HOME ?? process.env.LOCALAPPDATA ?? join(homedir(), ".cache");
const identity = createHash("sha256").update(project).digest("hex").slice(0,16);
const child = spawn("uv", ["run", "--quiet", "--frozen", "--no-dev", "--project", project, "--directory", project,
  "python", "-B", "-m", "iiif_ocr_modal"], { shell:false, windowsHide:true, stdio:"inherit",
  env:{...process.env,PYTHONUTF8:"1",PYTHONIOENCODING:"utf-8",UV_PROJECT_ENVIRONMENT:process.env.UV_PROJECT_ENVIRONMENT??join(cache,"jp-lit-mcp","ocr-modal",identity)} });
child.on("error",()=>{process.exitCode=4;});
child.on("exit",code=>{process.exitCode=code??4;});
