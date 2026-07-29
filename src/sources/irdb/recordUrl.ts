import { InvalidRequestError } from "../../lib/errors.js";
import { validateSourceId } from "../../lib/sourceId.js";

const IRDB_RECORD_HOSTNAME = "irdb.nii.ac.jp";

function validateIrdbSourceId(sourceId: string) {
  return validateSourceId("irdb", sourceId);
}

export function normalizeIrdbRecordUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname !== IRDB_RECORD_HOSTNAME ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    url.pathname = validateIrdbSourceId(url.pathname);
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveIrdbRecordUrl(
  detailBaseUrl: string,
  sourceId: string
): string {
  const validatedSourceId = validateIrdbSourceId(sourceId);
  const base = new URL(detailBaseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw new InvalidRequestError("IRDB detailBaseUrl の形式が不正です");
  }

  const resolved = new URL(validatedSourceId, base);
  if (resolved.origin !== base.origin) {
    throw new InvalidRequestError(
      "IRDB source_id は detailBaseUrl と同一 origin でなければなりません"
    );
  }

  return resolved.toString();
}
