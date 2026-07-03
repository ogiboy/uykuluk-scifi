import {
  clearCachedStudioMutationSession,
  studioMutationJsonHeaders,
} from "./studioMutationClient";

export type StudioMutationSubmitResult = Readonly<
  { kind: "error"; message: string } | { kind: "success" }
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
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    if (response.status === 401) {
      clearCachedStudioMutationSession();
    }
    return {
      kind: "error",
      message: payload?.message ?? input.fallbackError,
    };
  }
  return { kind: "success" };
}
