import {
  startSessionInputSchema,
  startSessionOutputSchema
} from "../lib/schemas.js";
import type { StartSessionOutput } from "../lib/schemas.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";

export function createJpLitStartSessionTool(sessionStore: SessionStore) {
  return async (input: unknown) => {
    const parsed = startSessionInputSchema.parse(input);
    const session = await sessionStore.startSession(parsed);
    const structuredContent: StartSessionOutput = startSessionOutputSchema.parse({
      session_id: session.session_id,
      created_at: session.created_at,
      trace: session.trace ?? {
        source_plans: [],
        open_questions: [],
        next_actions: []
      }
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
