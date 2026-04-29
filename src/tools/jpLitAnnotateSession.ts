import {
  annotateSessionInputSchema,
  annotateSessionOutputSchema
} from "../lib/schemas.js";
import type { AnnotateSessionOutput } from "../lib/schemas.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";

export function createJpLitAnnotateSessionTool(sessionStore: SessionStore) {
  return async (input: unknown) => {
    const parsed = annotateSessionInputSchema.parse(input);
    const session = await sessionStore.annotateEntry({
      tool: parsed.tool,
      cache_key: parsed.cache_key,
      selected_items: parsed.selected_items,
      notes: parsed.notes
    });

    const structuredContent: AnnotateSessionOutput =
      annotateSessionOutputSchema.parse({
        session_id: session.session_id,
        updated_at: session.updated_at,
        annotated_count: parsed.selected_items.length
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
