import { captureStudioUnexpectedError } from "../observability/studioObservability";
import {
  clearCachedStudioMutationSession,
  studioMutationJsonHeaders,
} from "./studioMutationClient";
import {
  summarizeStudioMutationRecord,
  type StudioMutationRecordSummary,
} from "./studioMutationResultSummary";

export type StudioMutationSubmitResult = Readonly<
  | {
      kind: "blocked";
      message: string;
      recordSummary: StudioMutationRecordSummary | null;
      status: number;
      warnings: readonly string[];
    }
  | { kind: "error"; message: string; status?: number }
  | {
      kind: "success";
      recordSummary: StudioMutationRecordSummary | null;
      warnings: readonly string[];
    }
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
    warnings?: unknown;
  } | null;
  const warnings = studioMutationWarnings(payload?.warnings);
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
        warnings,
      };
    }
    return {
      kind: "error",
      message: messageWithWarnings(payload?.message ?? input.fallbackError, warnings),
      status: response.status,
    };
  }
  return {
    kind: "success",
    recordSummary: summarizeStudioMutationRecord(payload?.record),
    warnings,
  };
}

function studioMutationWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => item.slice(0, 500));
}

function messageWithWarnings(message: string, warnings: readonly string[]): string {
  return warnings.length > 0 ? `${message} ${warnings.join(" ")}` : message;
}
