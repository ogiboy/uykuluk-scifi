import {
  clearCachedStudioMutationSession,
  studioMutationJsonHeaders,
} from "./studioMutationClient";
import {
  summarizeStudioMutationRecord,
  type StudioMutationRecordSummary,
} from "./studioMutationResultSummary";

export type StudioMutationSubmitResult = Readonly<
  | { kind: "blocked"; message: string; recordSummary: StudioMutationRecordSummary | null }
  | { kind: "error"; message: string }
  | { kind: "success"; recordSummary: StudioMutationRecordSummary | null }
>;

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
  const response = await fetch(input.routePath, {
    body: JSON.stringify(input.body),
    headers,
    method: "POST",
  });
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
      };
    }
    return {
      kind: "error",
      message: payload?.message ?? input.fallbackError,
    };
  }
  return { kind: "success", recordSummary: summarizeStudioMutationRecord(payload?.record) };
}
