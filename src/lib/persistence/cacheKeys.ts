import crypto from "node:crypto";

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    )) {
      if (nested === undefined) {
        continue;
      }

      normalized[key] = stableNormalize(nested);
    }

    return normalized;
  }

  return value ?? null;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

export function normalizeCacheInput(
  input: Record<string, unknown>
): Record<string, unknown> {
  return stableNormalize(input) as Record<string, unknown>;
}

export function createCacheKey(tool: string, input: Record<string, unknown>) {
  const hash = crypto
    .createHash("sha256")
    .update(`${tool}:${stableStringify(input)}`)
    .digest("hex");

  return `sha256-${hash}`;
}
