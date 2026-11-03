import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, fetchJson, fetchText, UnsupportedPayloadError, UpstreamHttpError, UpstreamTimeoutError } from "../src/lib/http.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("HTTPの本文期限", () => {
  it.each(["text", "json"] as const)("headers受信後の%s待ちも期限で終了する", async reader => {
    vi.useFakeTimers();
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    // この外部fetch代替はAbortSignalを処理しない。呼出側の期限自体を検証する。
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { bodyController = controller; }
    }), { headers: { "content-type": "application/json" } }));
    const response = await fetchWithTimeout("https://example.test", undefined, 50);
    expect(response.status).toBe(200);
    const result = response[reader]().catch(error => error);
    try {
      await vi.advanceTimersByTimeAsync(51);
      expect(await Promise.race([result, Promise.resolve("still_pending")])).toBeInstanceOf(UpstreamTimeoutError);
    } finally {
      bodyController.enqueue(new TextEncoder().encode("{}"));
      bodyController.close();
      await result;
    }
  });

  it("abortを無視するheaders待ちも期限で終了する", async () => {
    vi.useFakeTimers();
    let deliver!: (response: Response) => void;
    vi.stubGlobal("fetch", () => new Promise<Response>(resolve => { deliver = resolve; }));
    const result = fetchWithTimeout("https://example.test", undefined, 50).catch(error => error);
    try {
      await vi.advanceTimersByTimeAsync(51);
      expect(await Promise.race([result, Promise.resolve("still_pending")])).toBeInstanceOf(UpstreamTimeoutError);
    } finally { deliver(new Response("ok")); await result; }
  });

  it("期限内のJSONとtext、Response属性を保持する", async () => {
    vi.stubGlobal("fetch", async () => new Response('{"ok":true}', {
      status: 201, headers: { "content-type": "application/json" }
    }));
    expect(await fetchJson("https://example.test")).toEqual({ ok: true });
    expect(await fetchText("https://example.test")).toEqual({ text: '{"ok":true}', contentType: "application/json" });
    const response = await fetchWithTimeout("https://example.test");
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(201);
    expect(await response.text()).toBe('{"ok":true}');
  });

  it("非JSON本文をinvalid payload、HTTP異常をHTTP errorとして保持する", async () => {
    vi.stubGlobal("fetch", async () => new Response("not-json", { headers: { "content-type": "application/json" } }));
    await expect(fetchJson("https://example.test")).rejects.toBeInstanceOf(UnsupportedPayloadError);
    vi.stubGlobal("fetch", async () => new Response("unavailable", { status: 503 }));
    await expect(fetchText("https://example.test")).rejects.toEqual(new UpstreamHttpError(503, ""));
  });
});
