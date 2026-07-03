import { buildStudioRunReviewBrief } from "./runReviewBrief";
import type { StudioRunDetail } from "./runSummaries";

export const runReviewTabValues = [
  "progress",
  "media",
  "artifacts",
  "handoff",
  "readiness",
] as const;

export type RunReviewTab = (typeof runReviewTabValues)[number];

export type RunReviewTabFocus = Readonly<{
  detail: string;
  label: string;
  tab: RunReviewTab;
}>;

type RunReviewNavigationInput = Pick<
  StudioRunDetail,
  | "artifactCount"
  | "channelHandoff"
  | "channelHandoffDecision"
  | "evidenceStatus"
  | "finalReviewBundle"
  | "productionMedia"
  | "readinessStatus"
  | "renderDecision"
  | "state"
> &
  Parameters<typeof buildStudioRunReviewBrief>[0];

/**
 * Selects the most useful initial run-detail tab for the current operator task.
 *
 * @param run - The Studio run detail projection; this does not own workflow state.
 * @returns The tab that should be opened first for the current run review context.
 */
export function defaultRunReviewTab(run: RunReviewNavigationInput): RunReviewTab {
  return runReviewTabFocus(run).tab;
}

/**
 * Explains the initial run-detail tab selection for operator-facing copy.
 *
 * @param run - The Studio run detail projection; this does not own workflow state.
 * @returns The selected tab plus compact reason copy.
 */
export function runReviewTabFocus(run: RunReviewNavigationInput): RunReviewTabFocus {
  const brief = buildStudioRunReviewBrief(run);
  if (brief.severity === "blocked") {
    return {
      detail: "Local production blockers need attention before media can be trusted.",
      label: "Readiness",
      tab: "readiness",
    };
  }
  if (run.state === "RENDERED" && run.renderDecision.kind !== "present") {
    return {
      detail: "The local draft render is ready for watch-through and a durable decision.",
      label: "Media review",
      tab: "media",
    };
  }
  if (
    run.renderDecision.kind === "present" ||
    run.finalReviewBundle.kind === "present" ||
    run.channelHandoff.kind === "present" ||
    run.channelHandoffDecision.kind === "present"
  ) {
    return {
      detail: "Local review or manual channel handoff evidence is ready to inspect.",
      label: "Handoff",
      tab: "handoff",
    };
  }
  if (run.productionMedia.some((artifact) => artifact.status === "pass")) {
    return {
      detail: "Current evidence verifies at least one production media artifact.",
      label: "Media evidence",
      tab: "media",
    };
  }
  if (run.artifactCount > 0) {
    return {
      detail: "Persisted artifacts are available before later review evidence is complete.",
      label: "Artifacts",
      tab: "artifacts",
    };
  }
  return {
    detail: "No later review artifact is ready yet; start from workflow progress.",
    label: "Progress",
    tab: "progress",
  };
}
