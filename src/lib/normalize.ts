export function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";

  return normalized ? normalized : null;
}

export function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.flatMap((value) => {
    const normalized = normalizeText(value);

    return normalized ? [normalized] : [];
  });
}
