import { EventEmitter } from "node:events";
import { access } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";

const external=vi.hoisted(()=>({spawn:vi.fn()}));
vi.mock("node:child_process",()=>({spawn:external.spawn}));
import { modalBridge } from "../src/iiif/ocrModalBridge.js";
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
function child(){
  const c:any=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();
  c.stdin=new EventEmitter();c.stdin.end=vi.fn();c.kill=vi.fn();c.pid=undefined;
  external.spawn.mockReturnValue(c);return c;
}
it("preserves partial JSON, SDK error and call ID after malformed output",async()=>{
  const c=child(),pending=modalBridge({operation:"inspect"});
  const checked=expect(pending).rejects.toMatchObject({stdout:'{"partial":',stderr:"Modal call fc-proof\nSDK failure detail\n"});
  await vi.waitFor(()=>expect(c.stdin.end).toHaveBeenCalled());
  c.stdout.emit("data",Buffer.from('{"partial":'));c.stderr.emit("data",Buffer.from("Modal call fc-proof\nSDK failure detail\n"));c.emit("close",4);
  await checked;
});
it("requests cancellation before returning a host timeout and retains cancellation confirmation",async()=>{
  vi.useFakeTimers();const c=child(),pending=modalBridge({operation:"inspect"});
  const checked=expect(pending).rejects.toMatchObject({stderr:expect.stringContaining("Modal call cancelled fc-owned")});
  await vi.waitFor(()=>expect(c.stdin.end).toHaveBeenCalled());
  const cancelPath=external.spawn.mock.calls[0][2].env.JP_LIT_MODAL_CANCEL_PATH;
  c.stderr.emit("data",Buffer.from("Modal call fc-owned\n"));
  await vi.advanceTimersByTimeAsync(2400000);
  await vi.waitFor(async()=>{await access(cancelPath);});
  expect(c.kill).not.toHaveBeenCalled();
  c.stderr.emit("data",Buffer.from("Modal call cancelled fc-owned\n"));c.emit("close",4);
  await checked;
});
it.runIf(process.platform==="win32")("reclaims only its owned Windows helper tree after cancellation grace",async()=>{
  vi.useFakeTimers();const c=child();c.pid=98765;const stop=new EventEmitter();external.spawn.mockReturnValueOnce(c).mockReturnValueOnce(stop);
  const pending=modalBridge({operation:"inspect"}),checked=expect(pending).rejects.toMatchObject({stderr:"Modal call fc-owned\n"});
  await vi.waitFor(()=>expect(c.stdin.end).toHaveBeenCalled());c.stderr.emit("data",Buffer.from("Modal call fc-owned\n"));
  await vi.advanceTimersByTimeAsync(2415000);
  expect(external.spawn.mock.calls[1].slice(0,2)).toEqual(["taskkill.exe",["/PID","98765","/T","/F"]]);
  stop.emit("close",0);await checked;
});
