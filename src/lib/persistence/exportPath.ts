import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { InvalidRequestError } from "../errors.js";
import { getExportsRoot } from "./paths.js";

export interface ExportBoundary {
  baseDir: string;
  allowExternalPath: boolean;
}

function isPathInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function isSamePath(left: string, right: string) {
  return path.relative(left, right) === "";
}

function isMissingPathError(error: unknown) {
  return error instanceof Error && "code" in error && (
    error.code === "ENOENT" || error.code === "ENOTDIR"
  );
}

async function resolveVirtualRealPath(inputPath: string) {
  let existing = path.resolve(inputPath);
  const missingSegments: string[] = [];

  while (true) {
    try {
      const resolved = await realpath(existing);
      return path.resolve(resolved, ...missingSegments);
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw new InvalidRequestError("output_path could not be resolved safely");
      }

      const parent = path.dirname(existing);
      if (parent === existing) {
        throw new InvalidRequestError("output_path could not be resolved safely");
      }
      missingSegments.unshift(path.basename(existing));
      existing = parent;
    }
  }
}

async function assertDefaultExportBoundary(
  baseDir: string,
  exportsRoot: string,
  target: string
) {
  const resolvedBaseDir = await resolveVirtualRealPath(baseDir);
  const resolvedExportsRoot = await resolveVirtualRealPath(exportsRoot);
  const resolvedTarget = await resolveVirtualRealPath(target);
  const expectedExportsRoot = path.resolve(
    resolvedBaseDir,
    path.relative(path.resolve(baseDir), exportsRoot)
  );

  if (
    !isSamePath(resolvedExportsRoot, expectedExportsRoot) ||
    !isPathInside(resolvedExportsRoot, resolvedTarget)
  ) {
    throw new InvalidRequestError(
      "output_path outside exports requires allow_external_path=true"
    );
  }
}

export async function resolveExportTarget(input: {
  baseDir: string;
  outputPath: string;
  allowExternalPath: boolean;
}) {
  const exportsRoot = path.resolve(getExportsRoot(input.baseDir));
  const target = path.isAbsolute(input.outputPath)
    ? path.resolve(input.outputPath)
    : path.resolve(input.baseDir, input.outputPath);

  if (!isPathInside(exportsRoot, target) && !input.allowExternalPath) {
    throw new InvalidRequestError(
      "output_path outside exports requires allow_external_path=true"
    );
  }

  if (!input.allowExternalPath) {
    await assertDefaultExportBoundary(input.baseDir, exportsRoot, target);
  }

  return target;
}

export async function writeExportFile(
  target: string,
  data: string,
  overwrite: boolean,
  boundary?: ExportBoundary
) {
  if (boundary) {
    await resolveExportTarget({
      ...boundary,
      outputPath: target
    });
  }

  await mkdir(path.dirname(target), { recursive: true });

  if (boundary) {
    await resolveExportTarget({
      ...boundary,
      outputPath: target
    });
  }

  try {
    await writeFile(target, data, {
      encoding: "utf8",
      flag: overwrite ? "w" : "wx"
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new InvalidRequestError(
        "output_path already exists; overwrite=true is required to replace it"
      );
    }
    throw error;
  }
}
