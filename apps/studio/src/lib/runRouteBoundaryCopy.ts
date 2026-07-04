export type StudioRunRouteBoundaryCopy = Readonly<{
  description: string;
  heading: string;
  recoveryHeadingId: string;
  recoveryTitle: string;
  status: string;
}>;

/**
 * Operator-facing copy for missing run records in the Studio run review route.
 */
export const runDetailNotFoundCopy = {
  description:
    "Studio could not resolve this local run record. Missing run files never imply approval, readiness, upload permission, or publish permission. Return to the run queue and choose a current run before taking the next operator action.",
  heading: "Run not found",
  recoveryHeadingId: "run-detail-not-found-recovery-heading",
  recoveryTitle: "Safe next step",
  status: "No action taken",
} as const satisfies StudioRunRouteBoundaryCopy;

/**
 * Operator-facing copy for fail-closed run detail read errors in Studio.
 */
export const runDetailErrorCopy = {
  description:
    "The web surface stopped while reading this run. It did not retry approvals, change run state, trust artifacts without evidence, upload media, or publish content.",
  heading: "Run review failed safely",
  recoveryHeadingId: "run-detail-error-recovery-heading",
  recoveryTitle: "Safe recovery",
  status: "No action taken",
} as const satisfies StudioRunRouteBoundaryCopy;
