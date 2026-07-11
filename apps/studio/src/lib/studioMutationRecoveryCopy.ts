import type { StudioGuardedActionSubmitState } from "./useStudioGuardedActionSubmit";

export type StudioMutationRecoveryCopy = Readonly<{
  detail: string;
  href: "/forbidden" | "/unauthorized";
  label: string;
}>;

/**
 * Maps guarded Studio route failures to safe operator recovery pages.
 *
 * @param state - The latest guarded mutation state from the action panel.
 * @returns Route-boundary recovery copy for request/session failures, or `null`.
 */
export function studioMutationRecoveryCopy(
  state: StudioGuardedActionSubmitState,
): StudioMutationRecoveryCopy | null {
  if (!hasHttpStatus(state)) {
    return null;
  }
  if (state.status === 401) {
    return {
      detail:
        "The guarded route rejected the local session token before running the action. No CLI/core command ran and no producer state changed.",
      href: "/unauthorized",
      label: "Open session recovery",
    };
  }
  if (state.status === 403) {
    return {
      detail:
        "The guarded route rejected the request boundary before running the action. No CLI/core command ran and no producer state changed.",
      href: "/forbidden",
      label: "Open request boundary details",
    };
  }
  return null;
}

export function hasHttpStatus(
  state: StudioGuardedActionSubmitState,
): state is Extract<StudioGuardedActionSubmitState, { status?: number }> &
  Readonly<{ status: number }> {
  return "status" in state && typeof state.status === "number";
}
