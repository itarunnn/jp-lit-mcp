import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { InvalidRequestError } from "../errors.js";

export const CACHED_TOOL_NAMES = [
  "jp_lit_enrich_record",
  "jp_lit_find_authority_terms_by_classification",
  "jp_lit_get_fulltext",
  "jp_lit_get_record",
  "jp_lit_get_text_coordinates",
  "jp_lit_record_ndl_browser_search",
  "jp_lit_resolve_authority",
  "jp_lit_search",
  "jp_lit_search_fulltext",
  "jp_lit_search_guides_cases",
  "jp_lit_search_guides_manuals",
  "jp_lit_search_illustrations",
  "jp_lit_search_kaken_projects",
  "jp_lit_search_kokusho_fulltext",
  "jp_lit_search_kokusho_image_tags",
  "jp_lit_search_pages",
  "jp_lit_suggest_classification_codes"
] as const;

export const cachedToolSchema = z.enum(CACHED_TOOL_NAMES);
export const cacheKeySchema = z.string().regex(/^sha256-[0-9a-f]{64}$/);

function isMissingPathError(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function resolveRealPathThroughExistingAncestor(target: string) {
  let existingAncestor = path.resolve(target);
  const missingSegments: string[] = [];

  while (true) {
    try {
      return path.resolve(
        realpathSync.native(existingAncestor),
        ...missingSegments
      );
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }

      try {
        if (lstatSync(existingAncestor).isSymbolicLink()) {
          throw new InvalidRequestError(
            "cache path cannot use a dangling symbolic link"
          );
        }
      } catch (lstatError) {
        if (lstatError instanceof InvalidRequestError) {
          throw lstatError;
        }
        if (!isMissingPathError(lstatError)) {
          throw lstatError;
        }
      }

      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) {
        throw new InvalidRequestError("cache path could not be resolved");
      }
      missingSegments.unshift(path.basename(existingAncestor));
      existingAncestor = parent;
    }
  }
}

function isContained(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

export function resolveContainedCachePath(
  baseDir: string,
  root: string,
  ...segments: string[]
) {
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedRoot = path.resolve(root);
  if (!isContained(resolvedBaseDir, resolvedRoot)) {
    throw new InvalidRequestError(
      "cache root must remain inside the persistence base directory"
    );
  }

  const target = path.resolve(resolvedRoot, ...segments);
  if (!isContained(resolvedRoot, target)) {
    throw new InvalidRequestError("cache path must remain inside the cache root");
  }

  const realBaseDir = resolveRealPathThroughExistingAncestor(resolvedBaseDir);
  const realRoot = resolveRealPathThroughExistingAncestor(resolvedRoot);
  if (!isContained(realBaseDir, realRoot)) {
    throw new InvalidRequestError(
      "cache root must remain inside the persistence base directory"
    );
  }

  const realTarget = resolveRealPathThroughExistingAncestor(target);
  if (
    !isContained(realRoot, realTarget) ||
    !isContained(realBaseDir, realTarget)
  ) {
    throw new InvalidRequestError("cache path must remain inside the cache root");
  }

  return target;
}
