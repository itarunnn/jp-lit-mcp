import type { ZodTypeAny } from "zod";

import type { SessionStore } from "../../src/lib/persistence/sessionStore.js";

export const FIXTURE_SESSION_ID = "2026-08-08-120000-a1b2c3d4";

function withFixtureSession(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  return {
    session_id: FIXTURE_SESSION_ID,
    ...(input as Record<string, unknown>)
  };
}

function withoutSessionId<T>(value: T) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const { session_id: _sessionId, ...rest } = value as Record<string, unknown>;
  return rest;
}

export function bindSchemaForLegacyTest<TSchema extends ZodTypeAny>(schema: TSchema) {
  return {
    parse(input: unknown) {
      return withoutSessionId(schema.parse(withFixtureSession(input)));
    },
    safeParse(input: unknown) {
      const result = schema.safeParse(withFixtureSession(input));
      return result.success
        ? { ...result, data: withoutSessionId(result.data) }
        : result;
    }
  };
}

export function bindToolToCurrentSession<
  TResult,
  TTool extends (input: never) => Promise<TResult>
>(tool: TTool, sessions: SessionStore) {
  return async (input: unknown): Promise<TResult> => {
    const current = await sessions.readCurrent();
    const payload = input && typeof input === "object" && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {};
    return tool({
      session_id: current.session_id,
      ...payload
    } as never);
  };
}
