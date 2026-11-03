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
  let expire!: (error: UpstreamTimeoutError) => void;
  const deadline = new Promise<never>((_resolve, reject) => { expire = reject; });
  // headersだけを使う呼出しでもdeadlineの拒否を未処理にしない。
  void deadline.catch(() => undefined);
  const timeout = setTimeout(() => {
    expire(new UpstreamTimeoutError(timeoutMs));
    controller.abort();
  }, timeoutMs);
  timeout.unref();

  async function withinDeadline<T>(operation: Promise<T>): Promise<T> {
    return Promise.race([operation, deadline]);
  }

  try {
    const response = await withinDeadline(fetch(input, {
      ...init,
      signal: controller.signal
    }));
    // Response属性とheaders直後の返却を保ち、本文readerにも同じ期限を適用する。
    return new Proxy(response, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (typeof value !== "function") return value;
        if (["text", "json", "arrayBuffer", "blob", "formData", "bytes"].includes(String(property))) {
          return async (...args: unknown[]) => {
            try {
              return await withinDeadline(Promise.resolve(Reflect.apply(value, target, args)));
            } finally {
              clearTimeout(timeout);
            }
          };
        }
        return value.bind(target);
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamTimeoutError(timeoutMs);
    }

    throw error;
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
