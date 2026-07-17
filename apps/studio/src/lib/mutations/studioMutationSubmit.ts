import { captureStudioUnexpectedError } from "../observability/studioObservability";
import {
  clearCachedStudioMutationSession,
  studioMutationJsonHeaders,
} from "./studioMutationClient";
import {
  summarizeStudioMutationRecord,
  type StudioMutationRecordSummary,
} from "./studioMutationResultSummary";
import { studioMutationWarnings } from "./studioMutationWarnings";

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
export const hostedVisualMutationFetchTimeoutMs = 4 * 60 * 60 * 1_000 + 2 * 60 * 1_000;

/**
 * Selects the client wait timeout for a Studio mutation action.
 *
 * @param actionId - The identifier of the mutation action.
 * @returns The extended timeout for hosted visual generation, or the default mutation timeout for other actions.
 */
export function studioMutationFetchTimeoutForAction(actionId: string): number {
  return actionId === "visuals.generate-hosted"
    ? hostedVisualMutationFetchTimeoutMs
    : studioMutationFetchTimeoutMs;
}

/**
 * Submits a guarded same-origin Studio mutation and classifies its outcome for operator workflows.
 *
 * @param input - The action route, action identifier, JSON-serializable payload, and fallback error message.
 * @returns A success, blocked, or error result with any record summary, warnings, or HTTP status.
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
  const timeout = setTimeout(
    () => controller.abort(),
    studioMutationFetchTimeoutForAction(input.actionId),
  );
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
    return {
      kind: "error",
      message:
        input.actionId === "visuals.generate-hosted" && isAbortError(error)
          ? "Hosted visual execution exceeded the Studio wait window. Its durable operation may still require reconciliation; refresh this run before retrying."
          : input.fallbackError,
    };
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

/**
 * Determines whether an error represents an aborted operation.
 *
 * @param error - The value to inspect.
 * @returns `true` if the value is an error named `AbortError`, `false` otherwise.
 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function messageWithWarnings(message: string, warnings: readonly string[]): string {
  return warnings.length > 0 ? `${message} ${warnings.join(" ")}` : message;
}
