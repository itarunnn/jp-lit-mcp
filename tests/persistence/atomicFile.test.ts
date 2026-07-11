import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  rename: vi.fn(),
  rm: vi.fn()
}));

vi.mock("node:fs/promises", () => fsMocks);

import { replaceFileAtomically } from "../../src/lib/persistence/atomicFile.js";

function fsError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("replaceFileAtomically", () => {
  beforeEach(() => {
    fsMocks.rename.mockReset();
    fsMocks.rm.mockReset();
    fsMocks.rm.mockResolvedValue(undefined);
  });

  it("restores the previous target when replacement fails", async () => {
    fsMocks.rename
      .mockRejectedValueOnce(fsError("EPERM"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(fsError("EIO"))
      .mockResolvedValueOnce(undefined);

    await expect(
      replaceFileAtomically("current.tmp", "current.json")
    ).rejects.toThrow("EIO");

    const backup = fsMocks.rename.mock.calls[1]?.[1] as string;
    expect(fsMocks.rename).toHaveBeenNthCalledWith(4, backup, "current.json");
  });

  it("preserves the backup and reports its path when restoration fails", async () => {
    fsMocks.rename
      .mockRejectedValueOnce(fsError("EPERM"))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(fsError("EIO"))
      .mockRejectedValueOnce(fsError("EACCES"));

    const error = await replaceFileAtomically("current.tmp", "current.json").catch(
      (reason: unknown) => reason as Error
    );
    const backup = fsMocks.rename.mock.calls[1]?.[1] as string;

    expect(error.message).toContain(`backup preserved at ${backup}`);
    expect(fsMocks.rm).not.toHaveBeenCalledWith(
      backup,
      expect.anything()
    );
  });
});
