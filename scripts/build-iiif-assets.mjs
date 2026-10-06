import {
  cp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  access,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = new URL("../", import.meta.url),
  out = new URL("dist/iiif/web/", root);
await mkdir(new URL("vendor/", out), { recursive: true });
await cp(new URL("packages/iiif-workbench/web/", root), out, {
  recursive: true,
});
// 同一の領域対応判定をNode exportとブラウザへ配布する。
await cp(new URL("src/iiif/tei-state.mjs", root), new URL("dist/src/iiif/tei-state.mjs", root));
await cp(new URL("src/iiif/tei-state.mjs", root), new URL("tei-state.mjs", out));
await cp(new URL("src/iiif/ocr-state.mjs", root), new URL("dist/src/iiif/ocr-state.mjs", root));
await cp(new URL("src/iiif/ocr-state.mjs", root), new URL("ocr-state.mjs", out));
await cp(new URL("src/iiif/manual-ocr-state.mjs", root), new URL("dist/src/iiif/manual-ocr-state.mjs", root));
await cp(new URL("src/iiif/manual-ocr-state.mjs", root), new URL("manual-ocr-state.mjs", out));
await cp(
  new URL("node_modules/mirador/dist/mirador.min.js", root),
  new URL("vendor/mirador.min.js", out),
);
await cp(
  new URL("node_modules/mirador/LICENSE", root),
  new URL("vendor/MIRADOR-LICENSE.txt", out),
);
// UMD bundleに含まれるlicense commentを配布し、上流packageとbundleの所在を記す。
await writeFile(
  new URL("vendor/NOTICE.txt", out),
  "Mirador 4.2.6 — https://github.com/ProjectMirador/mirador\nApache-2.0; see MIRADOR-LICENSE.txt. Bundled dependencies retain their license comments in mirador.min.js.\n",
);
const pkg = JSON.parse(
  await readFile(new URL("node_modules/mirador/package.json", root), "utf8"),
);
if (pkg.version !== "4.2.6")
  throw new Error(`Mirador版を確認してください: ${pkg.version}`);
const visited = new Set(),
  notices = [];
async function findPackage(name, from) {
  let directory = from;
  for (;;) {
    const candidate = path.join(directory, "node_modules", name);
    try {
      await access(path.join(candidate, "package.json"));
      return candidate;
    } catch {}
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}
async function collect(directory) {
  const metadata = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  const key = `${metadata.name}@${metadata.version}`;
  if (visited.has(key)) return;
  visited.add(key);
  const licenses = (await readdir(directory)).filter((file) =>
    /^(?:licen[sc]e|copying|notice)(?:[.-].*)?$/i.test(file),
  );
  notices.push(
    `\n===== ${key} (${typeof metadata.license === "string" ? metadata.license : JSON.stringify(metadata.license)}) =====\n`,
  );
  for (const file of licenses)
    notices.push(await readFile(path.join(directory, file), "utf8"));
  if (!licenses.length)
    notices.push(
      `Package license declaration: ${JSON.stringify(metadata.license)}\nAuthor: ${JSON.stringify(metadata.author ?? metadata.contributors ?? null)}\n`,
    );
  for (const name of Object.keys({
    ...metadata.dependencies,
    ...metadata.peerDependencies,
  })) {
    const dependency = await findPackage(name, directory);
    if (dependency) await collect(dependency);
    else if (!metadata.peerDependenciesMeta?.[name]?.optional)
      throw new Error(`許諾収集の依存を確認してください: ${key} -> ${name}`);
  }
}
await collect(fileURLToPath(new URL("node_modules/mirador/", root)));
await writeFile(
  new URL("vendor/THIRD-PARTY-LICENSES.txt", out),
  notices.join("\n"),
);
console.error(`IIIF assets: ${fileURLToPath(out)}`);
