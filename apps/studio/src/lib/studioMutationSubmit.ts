import {
  clearCachedStudioMutationSession,
  studioMutationJsonHeaders,
} from "./studioMutationClient";
import {
  summarizeStudioMutationRecord,
  type StudioMutationRecordSummary,
} from "./studioMutationResultSummary";
import { captureStudioUnexpectedError } from "./studioObservability";

export type StudioMutationSubmitResult = Readonly<
  | {
      kind: "blocked";
      message: string;
      recordSummary: StudioMutationRecordSummary | null;
      status: number;
    }
  | { kind: "error"; message: string; status?: number }
  | { kind: "success"; recordSummary: StudioMutationRecordSummary | null }
>;

export const studioMutationFetchTimeoutMs = 30_000;

/**
 * Posts a guarded same-origin Studio mutation request with a local session proof.
 *
 * @param input - The Studio action route, action id, JSON body, and fallback error copy.
 * @returns A success marker or operator-facing error message.
 */
export async function submitStudioJsonMutation(input: {
  actionId: string;
  body: unknown;
  fallbackError: string;
  routePath: string;
}): Promise<StudioMutationSubmitResult> {
  let headers;
  try {
    headers = await studioMutationJsonHeaders(input.actionId);
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "Studio local session failed.",
    };
  }
  let body: string;
  try {
    body = JSON.stringify(input.body);
  } catch {
    return { kind: "error", message: "Studio action payload is not valid JSON." };
  }
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), studioMutationFetchTimeoutMs);
  try {
    response = await fetch(input.routePath, {
      body,
      headers,
      method: "POST",
      signal: controller.signal,
    });
  } catch (error) {
    captureStudioUnexpectedError(error, {
      actionId: input.actionId,
      boundary: "client-mutation",
      routePath: input.routePath,
    });
    return { kind: "error", message: input.fallbackError };
  } finally {
    clearTimeout(timeout);
  }
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    record?: unknown;
  } | null;
  if (!response.ok) {
    if (response.status === 401) {
      clearCachedStudioMutationSession();
    }
    if (payload?.record) {
      return {
        kind: "blocked",
        message:
          payload.message ??
          "Studio action wrote local output but the producer CLI reported a blocked state.",
        recordSummary: summarizeStudioMutationRecord(payload.record),
        status: response.status,
      };
    }
    return {
      kind: "error",
      message: payload?.message ?? input.fallbackError,
      status: response.status,
    };
  }
  return { kind: "success", recordSummary: summarizeStudioMutationRecord(payload?.record) };
}
