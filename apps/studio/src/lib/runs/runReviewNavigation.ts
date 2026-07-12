import type { StudioRunDetail } from "../runSummaries";
import { buildStudioRunReviewBrief } from "./runReviewBrief";

export const runReviewTabValues = [
  "progress",
  "media",
  "artifacts",
  "handoff",
  "readiness",
] as const;

export type RunReviewTab = (typeof runReviewTabValues)[number];

export type RunReviewTabFocus = Readonly<{ detail: string; label: string; tab: RunReviewTab }>;

export type RunReviewSearchParams = Readonly<Record<string, string | string[] | undefined>>;

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

type RunReviewSummaryNavigationInput = Pick<
  StudioRunDetail,
  | "artifactCount"
  | "blockedActionCount"
  | "channelHandoff"
  | "channelHandoffDecision"
  | "finalReviewBundle"
  | "readinessStatus"
  | "renderDecision"
  | "runId"
  | "state"
>;

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
 * Selects a run-detail tab from summary data used by queue links.
 *
 * @param run - The Studio run summary projection; this does not own workflow state.
 * @returns The tab that should be opened first from list or queue navigation.
 */
export function defaultRunReviewTabFromSummary(run: RunReviewSummaryNavigationInput): RunReviewTab {
  if (run.blockedActionCount > 0 || run.readinessStatus === "blocked") {
    return "readiness";
  }
  if (run.state === "RENDERED" && run.renderDecision.kind !== "present") {
    return "media";
  }
  if (hasHandoffEvidence(run)) {
    return "handoff";
  }
  if (run.artifactCount > 0) {
    return "artifacts";
  }
  return "progress";
}

/**
 * Parses a run-review tab query parameter while preserving a safe fallback.
 *
 * @param searchParams - Next.js route search parameters.
 * @param fallback - Tab to use when the URL value is missing or unsupported.
 * @returns A supported run-review tab value.
 */
export function runReviewTabFromSearchParams(
  searchParams: RunReviewSearchParams | undefined,
  fallback: RunReviewTab,
): RunReviewTab {
  const candidate = firstSearchParamValue(searchParams?.tab);
  return isRunReviewTab(candidate) ? candidate : fallback;
}

/**
 * Builds a run-review href that can deep-link into a specific operator tab.
 *
 * @param runId - The persisted run identifier.
 * @param tab - The run-review tab to open.
 * @param fragment - Optional page fragment.
 * @returns A local Studio run-review href.
 */
export function runReviewHref(runId: string, tab: RunReviewTab, fragment?: string): string {
  const suffix = fragment ? `#${fragment}` : "";
  return `/runs/${encodeURIComponent(runId)}?tab=${tab}${suffix}`;
}

/**
 * Builds a run-review href from queue summary data.
 *
 * @param run - The Studio run summary projection.
 * @param fragment - Optional page fragment.
 * @returns A local Studio run-review href focused on the next useful tab.
 */
export function runReviewHrefFromSummary(
  run: RunReviewSummaryNavigationInput,
  fragment?: string,
): string {
  return runReviewHref(run.runId, defaultRunReviewTabFromSummary(run), fragment);
}

/**
 * Rebuilds the current run-review URL after an operator changes tabs.
 *
 * @param pathname - Current pathname from Next.js navigation.
 * @param searchParams - Current query string or object with URLSearchParams-compatible serialization.
 * @param tab - The selected run-review tab.
 * @param fragment - Optional page fragment to retain.
 * @returns A URL path with the selected tab query parameter.
 */
export function runReviewPathWithTab(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString"> | string,
  tab: RunReviewTab,
  fragment?: string,
): string {
  const params = new URLSearchParams(
    typeof searchParams === "string" ? searchParams : searchParams.toString(),
  );
  params.set("tab", tab);
  const query = params.toString();
  const suffix = fragment ? `#${fragment}` : "";
  return query ? `${pathname}?${query}${suffix}` : `${pathname}${suffix}`;
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
  if (hasHandoffEvidence(run)) {
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

function firstSearchParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRunReviewTab(value: string | undefined): value is RunReviewTab {
  return runReviewTabValues.includes(value as RunReviewTab);
}

function hasHandoffEvidence(
  run: Pick<
    StudioRunDetail,
    "channelHandoff" | "channelHandoffDecision" | "finalReviewBundle" | "renderDecision"
  >,
): boolean {
  return (
    run.renderDecision.kind === "present" ||
    run.finalReviewBundle.kind === "present" ||
    run.channelHandoff.kind === "present" ||
    run.channelHandoffDecision.kind === "present"
  );
}
