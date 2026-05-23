import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function findPackageJson(fromUrl = import.meta.url) {
  const currentDir = dirname(fileURLToPath(fromUrl));
  return [
    resolve(currentDir, "../../../package.json"),
    resolve(currentDir, "../../package.json"),
    resolve(currentDir, "../package.json")
  ].find((candidate) => existsSync(candidate));
}

export function readPackageVersion(fromUrl = import.meta.url) {
  const packageJsonPath = findPackageJson(fromUrl);
  if (!packageJsonPath) {
    throw new Error("package.json not found");
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };
  return packageJson.version ?? "0.0.0";
}
