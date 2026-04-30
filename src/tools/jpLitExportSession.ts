import {
  exportSessionInputSchema,
  exportSessionOutputSchema
} from "../lib/schemas.js";
import type { ExportSessionOutput } from "../lib/schemas.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";
import type { SessionExporter } from "../lib/persistence/exportSession.js";

export function createJpLitExportSessionTool(
  sessionStore: SessionStore,
  exporter: SessionExporter
) {
  return async (input: unknown) => {
    const parsed = exportSessionInputSchema.parse(input);
    const session = await sessionStore.readCurrent();
    const exported = await exporter.exportSession({
      session,
      format: parsed.format,
      profile: parsed.profile,
      outputPath: parsed.output_path,
      includeUnselected: parsed.include_unselected
    });

    const structuredContent: ExportSessionOutput = exportSessionOutputSchema.parse({
      session_id: session.session_id,
      format: parsed.format,
      profile: parsed.profile,
      path: exported.path,
      exported_at: new Date().toISOString(),
      item_count: exported.itemCount
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  };
}
