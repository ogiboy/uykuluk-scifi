export type StudioRouteBoundaryCopy = Readonly<{
  description: string;
  eyebrow: string;
  heading: string;
  primaryActionHref?: "/" | "/runs";
  primaryActionLabel?: string;
  recoveryHeadingId: string;
  recoveryTitle: string;
  status: "No action taken" | "Request blocked" | "Session required";
}>;

/**
 * Operator-facing copy for unknown Studio routes or missing local resources.
 */
export const studioNotFoundCopy = {
  description:
    "Studio could not find this page or local run resource. Missing routes and missing files never imply approval, readiness, upload permission, or publish permission.",
  eyebrow: "Route boundary",
  heading: "Studio route not found",
  recoveryHeadingId: "studio-not-found-recovery-heading",
  recoveryTitle: "Safe next step",
  status: "No action taken",
} as const satisfies StudioRouteBoundaryCopy;

/**
 * Operator-facing copy for fail-closed Studio route errors.
 */
export const studioErrorCopy = {
  description:
    "The web surface stopped at this route boundary. It did not retry approvals, change run state, upload media, publish content, or infer readiness from local files.",
  eyebrow: "Route boundary",
  heading: "Studio page failed safely",
  recoveryHeadingId: "studio-error-recovery-heading",
  recoveryTitle: "Safe recovery",
  status: "No action taken",
} as const satisfies StudioRouteBoundaryCopy;

/**
 * Operator-facing copy for rejected unsafe web-control attempts.
 */
export const studioForbiddenCopy = {
  description:
    "Studio rejected this web-control attempt before it reached CLI/core execution. Check same-origin access, the expected action contract, and the current readiness/evidence state before retrying.",
  eyebrow: "403 trust boundary",
  heading: "Studio action blocked",
  recoveryHeadingId: "studio-forbidden-recovery-heading",
  recoveryTitle: "Safe recovery",
  status: "Request blocked",
} as const satisfies StudioRouteBoundaryCopy;

/**
 * Operator-facing copy for missing local web-control session proof.
 */
export const studioUnauthorizedCopy = {
  description:
    "Studio could not verify a valid local web-control session. Refresh the local session from the operator desk before retrying any approval or review action. No producer state was changed.",
  eyebrow: "401 trust boundary",
  heading: "Local web session required",
  primaryActionHref: "/",
  primaryActionLabel: "Open operator desk session controls",
  recoveryHeadingId: "studio-unauthorized-recovery-heading",
  recoveryTitle: "Safe recovery",
  status: "Session required",
} as const satisfies StudioRouteBoundaryCopy;

/**
 * Operator-facing copy for missing run records in the Studio run review route.
 */
export const runDetailNotFoundCopy = {
  description:
    "Studio could not resolve this local run record. Missing run files never imply approval, readiness, upload permission, or publish permission. Return to the run queue and choose a current run before taking the next operator action.",
  eyebrow: "Run review boundary",
  heading: "Run not found",
  recoveryHeadingId: "run-detail-not-found-recovery-heading",
  recoveryTitle: "Safe next step",
  status: "No action taken",
} as const satisfies StudioRouteBoundaryCopy;

/**
 * Operator-facing copy for fail-closed run detail read errors in Studio.
 */
export const runDetailErrorCopy = {
  description:
    "The web surface stopped while reading this run. It did not retry approvals, change run state, trust artifacts without evidence, upload media, or publish content.",
  eyebrow: "Run review boundary",
  heading: "Run review failed safely",
  recoveryHeadingId: "run-detail-error-recovery-heading",
  recoveryTitle: "Safe recovery",
  status: "No action taken",
} as const satisfies StudioRouteBoundaryCopy;
