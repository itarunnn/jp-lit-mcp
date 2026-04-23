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

export async function fetchJson<T>(
  input: string | URL,
  init?: RequestInit
): Promise<T> {
  const response = init ? await fetch(input, init) : await fetch(input);

  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }

  return response.json() as Promise<T>;
}
