import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";

export async function replaceFileAtomically(temp: string, target: string) {
  const backup = `${target}.${process.pid}.${randomUUID()}.bak`;
  let preserveBackup = false;

  try {
    try {
      await rename(temp, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST" && code !== "EPERM") {
        throw error;
      }
    }

    await rename(target, backup);

    try {
      await rename(temp, target);
    } catch (replacementError) {
      try {
        await rename(backup, target);
      } catch (restoreError) {
        preserveBackup = true;
        throw new AggregateError(
          [replacementError, restoreError],
          `File replacement and restoration failed; backup preserved at ${backup}`
        );
      }
      throw replacementError;
    }
  } finally {
    if (!preserveBackup) {
      await rm(backup, { force: true, recursive: true });
    }
  }
}
