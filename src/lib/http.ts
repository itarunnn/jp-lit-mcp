export class UpstreamHttpError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`Upstream request failed: ${status} ${statusText}`);
    this.name = "UpstreamHttpError";
    this.status = status;
    this.statusText = statusText;
  }
}

export class UpstreamTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Upstream request timed out after ${timeoutMs}ms`);
    this.name = "UpstreamTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class UnsupportedPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedPayloadError";
  }
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }

  const normalized = contentType.toLowerCase();

  return (
    normalized.includes("application/json") ||
    normalized.includes("+json") ||
    normalized.includes("text/json")
  );
}

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: string | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOkResponse(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetchWithTimeout(input, init);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  return response;
}

export async function fetchJson<T>(
  input: string | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetchOkResponse(input, init);

  const contentType = response.headers?.get("content-type") ?? null;
  if (!isJsonContentType(contentType)) {
    throw new UnsupportedPayloadError(
      `JSON payload required but received ${contentType}`
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UnsupportedPayloadError(
        "JSON payload required but upstream returned non-JSON content"
      );
    }

    throw error;
  }
}

export async function fetchText(
  input: string | URL,
  init?: RequestInit
): Promise<{ text: string; contentType: string | null }> {
  const response = await fetchOkResponse(input, init);

  return {
    text: await response.text(),
    contentType: response.headers?.get("content-type") ?? null
  };
}
