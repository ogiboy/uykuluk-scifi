import * as Sentry from "@sentry/nextjs";

export type StudioUnexpectedErrorContext = Readonly<{
  actionId?: string;
  boundary: "client-mutation" | "route-mutation" | "route-render";
  routePath?: string;
}>;

/**
 * Reports an unexpected Studio boundary failure without attaching request payloads or artifacts.
 *
 * Observability is best-effort only and never participates in workflow state, approval, readiness,
 * or route authorization decisions.
 *
 * @param error - The unexpected boundary error.
 * @param context - Bounded route metadata safe to attach to telemetry.
 */
export function captureStudioUnexpectedError(
  error: unknown,
  context: StudioUnexpectedErrorContext,
): void {
  const safeError = new Error("Unexpected Studio boundary failure");
  safeError.name = safeErrorName(error);
  safeError.stack = undefined;
  Sentry.captureException(safeError, {
    contexts: {
      studio: {
        actionId: context.actionId ?? "unknown",
        boundary: context.boundary,
        routePath: context.routePath ?? "unknown",
      },
    },
    tags: { "studio.boundary": context.boundary },
  });
}

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) {
    return "UnknownStudioError";
  }
  const normalized = error.name.replaceAll(/[^A-Za-z0-9_.-]/g, "").slice(0, 64);
  return normalized || "StudioError";
}
