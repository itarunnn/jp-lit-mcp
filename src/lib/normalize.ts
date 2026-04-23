export function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";

  return normalized ? normalized : null;
}
