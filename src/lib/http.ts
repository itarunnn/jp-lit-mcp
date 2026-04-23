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

export async function fetchJson<T>(
  input: string | URL,
  init?: RequestInit
): Promise<T> {
  const response = init ? await fetch(input, init) : await fetch(input);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

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
