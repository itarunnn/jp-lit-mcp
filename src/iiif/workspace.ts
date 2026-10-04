import { randomUUID } from "node:crypto";
import {
  readFile,
  writeFile,
  rename,
  link,
  unlink,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import { validateWorkspace } from "./schemas.js";
import type { IiifWorkspace } from "./types.js";

export async function atomicWrite(
  file: string,
  content: string | Uint8Array,
  overwrite = false,
) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, content, { flag: "wx" });
    if (overwrite) await rename(temp, file);
    else {
      await link(temp, file);
      await unlink(temp);
    }
  } finally {
    await unlink(temp).catch(() => {});
  }
}
export async function saveWorkspace(
  file: string,
  value: unknown,
  overwrite: boolean,
): Promise<void> {
  if (!path.isAbsolute(file))
    throw new Error("workspaceは絶対pathで指定してください");
  await atomicWrite(
    file,
    JSON.stringify(validateWorkspace(value), null, 2) + "\n",
    overwrite,
  );
}
export async function readWorkspace(file: string): Promise<IiifWorkspace> {
  const text = await readFile(file, "utf8");
  if (Buffer.byteLength(text) > 45 * 1024 * 1024)
    throw new Error("workspace容量が上限を超えます");
  return validateWorkspace(JSON.parse(text));
}
