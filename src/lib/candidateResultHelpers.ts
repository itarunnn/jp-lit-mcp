function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseStrictUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.trim() !== value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasStrictUrlBoundary(url: URL, hostname: string) {
  return url.protocol === "https:"
    && url.hostname === hostname
    && url.username === ""
    && url.password === ""
    && url.port === ""
    && url.search === ""
    && url.hash === "";
}

export function isValidNdlDigitalViewerUrl(value: unknown, pid: unknown): boolean {
  if (typeof pid !== "string" || !/^\d+$/.test(pid)) return false;
  const url = parseStrictUrl(value);
  if (!url || !hasStrictUrlBoundary(url, "dl.ndl.go.jp")) return false;

  const pathPid = url.pathname.match(
    /^\/pid\/(\d+)(?:\/[A-Za-z0-9._~-]+)*\/?$/
  )?.[1];
  return pathPid === pid;
}

export function isValidNdlSearchDigitalItemIdentity(
  sourceId: unknown,
  urlValue: unknown,
  sourceMetadata: unknown
): boolean {
  if (typeof sourceId !== "string") return false;
  const pid = sourceId.match(/^R100000039-I(\d+)$/)?.[1];
  if (!pid) return false;

  const url = parseStrictUrl(urlValue);
  if (
    !url
    || !hasStrictUrlBoundary(url, "ndlsearch.ndl.go.jp")
    || url.pathname !== `/books/${sourceId}`
  ) {
    return false;
  }

  const metadata = asRecord(sourceMetadata);
  return !metadata
    || !Object.prototype.hasOwnProperty.call(metadata, "pid")
    || metadata.pid === pid;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const record = asRecord(value);
  if (record) {
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function checkedAt(value: unknown): string | null {
  const candidate = asRecord(value)?.checked_at;
  return typeof candidate === "string" ? candidate : null;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareBrowserObservationsChronologically(
  left: unknown,
  right: unknown
): number {
  const leftCheckedAt = checkedAt(left);
  const rightCheckedAt = checkedAt(right);
  const leftInstant = leftCheckedAt === null ? Number.NaN : Date.parse(leftCheckedAt);
  const rightInstant = rightCheckedAt === null ? Number.NaN : Date.parse(rightCheckedAt);
  const leftIsFinite = Number.isFinite(leftInstant);
  const rightIsFinite = Number.isFinite(rightInstant);

  if (leftIsFinite && rightIsFinite && leftInstant !== rightInstant) {
    return leftInstant - rightInstant;
  }
  if (leftIsFinite !== rightIsFinite) {
    return leftIsFinite ? 1 : -1;
  }

  const checkedAtOrder = compareStrings(leftCheckedAt ?? "", rightCheckedAt ?? "");
  return checkedAtOrder || compareStrings(stableSerialize(left), stableSerialize(right));
}

export function latestBrowserObservation<T>(observations: readonly T[]): T | undefined {
  let latest: T | undefined;
  for (const observation of observations) {
    if (
      latest === undefined
      || compareBrowserObservationsChronologically(latest, observation) < 0
    ) {
      latest = observation;
    }
  }
  return latest;
}
