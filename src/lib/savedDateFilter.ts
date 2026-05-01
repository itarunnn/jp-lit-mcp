const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type SavedOnShortcut = "today" | "yesterday" | "last_7_days";

export type SavedDateFilterInput = {
  saved_on?: string;
  saved_from?: string;
  saved_to?: string;
};

export type SavedDateFilterResolution = {
  effectiveSavedFrom: string | undefined;
  effectiveSavedTo: string | undefined;
  resolvedSavedOn: string | null;
};

function formatJstDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function toJstDayRange(dateOnly: string): {
  from: string;
  to: string;
} {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const startUtcMs = Date.UTC(year, month - 1, day, -9, 0, 0, 0);
  const endUtcMs = Date.UTC(year, month - 1, day, 14, 59, 59, 999);
  return {
    from: new Date(startUtcMs).toISOString(),
    to: new Date(endUtcMs).toISOString()
  };
}

function resolveSavedOn(
  savedOn: string | undefined,
  now: Date
): { from: string; to: string; resolvedSavedOn: string } | null {
  if (!savedOn) {
    return null;
  }

  if (DATE_ONLY.test(savedOn)) {
    const range = toJstDayRange(savedOn);
    return { from: range.from, to: range.to, resolvedSavedOn: savedOn };
  }

  const today = formatJstDate(now);
  if (savedOn === "today") {
    const range = toJstDayRange(today);
    return { from: range.from, to: range.to, resolvedSavedOn: today };
  }
  if (savedOn === "yesterday") {
    const yesterday = addDays(today, -1);
    const range = toJstDayRange(yesterday);
    return { from: range.from, to: range.to, resolvedSavedOn: yesterday };
  }
  if (savedOn === "last_7_days") {
    const fromDate = addDays(today, -6);
    const fromRange = toJstDayRange(fromDate);
    const toRange = toJstDayRange(today);
    return { from: fromRange.from, to: toRange.to, resolvedSavedOn: today };
  }

  return null;
}

export function resolveSavedDateFilter(
  input: SavedDateFilterInput,
  now = new Date()
): SavedDateFilterResolution {
  const resolved = resolveSavedOn(input.saved_on, now);
  if (resolved) {
    return {
      effectiveSavedFrom: resolved.from,
      effectiveSavedTo: resolved.to,
      resolvedSavedOn: resolved.resolvedSavedOn
    };
  }

  return {
    effectiveSavedFrom: input.saved_from,
    effectiveSavedTo: input.saved_to,
    resolvedSavedOn: null
  };
}
