import {
  updateSessionTraceInputSchema,
  updateSessionTraceOutputSchema
} from "../lib/schemas.js";
import type { UpdateSessionTraceOutput } from "../lib/schemas.js";
import type { SessionStore } from "../lib/persistence/sessionStore.js";

export function createJpLitUpdateSessionTraceTool(sessionStore: SessionStore) {
  return async (input: unknown) => {
    const parsed = updateSessionTraceInputSchema.parse(input);
    const session = await sessionStore.updateTrace(parsed);

    const structuredContent: UpdateSessionTraceOutput =
      updateSessionTraceOutputSchema.parse({
        session_id: session.session_id,
        updated_at: session.updated_at,
        source_plan_count: session.trace?.source_plans.length ?? 0,
        open_question_count: session.trace?.open_questions.length ?? 0,
        next_action_count: session.trace?.next_actions.length ?? 0
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
