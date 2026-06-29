import { SafeExitError } from "../core/errors.js";
import { listRuns } from "../core/runStore.js";
import type { RunState } from "../core/state.js";
import type { RenderDecisionStatus } from "../stages/renderDecisionStatus.js";
import { readRunStatus, type RunStatusSummary } from "../stages/status.js";

const RECENT_RUN_LIMIT = 8;

export type OperatorDeskOptions = {
  latest?: boolean;
  runId?: string;
};

export type OperatorDeskRun = {
  approvalCount: number;
  artifactCount: number;
  blockedActionCount: number | null;
  evidenceStatus: string;
  nextRecommendedCommand: string;
  readinessStatus: string;
  renderDecisionStatus: RenderDecisionStatus["kind"];
  runId: string;
  state: RunState;
  updatedAt: string;
  warningCount: number;
};

export type OperatorDeskSelectedRun = OperatorDeskRun & {
  blockedActions: string[];
  mediaArtifacts: RunStatusSummary["mediaArtifacts"];
  recentArtifacts: string[];
  renderDecision: RenderDecisionStatus;
};

export type OperatorDeskViewModel = {
  generatedAt: string;
  latestRunId: string | null;
  runDetails: OperatorDeskSelectedRun[];
  runs: OperatorDeskRun[];
  selectedRun: OperatorDeskSelectedRun | null;
};

/**
 * Builds the operator desk model from persisted run state and status summaries.
 *
 * @param options - Selection options for the desk.
 * @returns A read-only operator desk view model.
 */
export async function buildOperatorDeskViewModel(
  options: OperatorDeskOptions = {},
): Promise<OperatorDeskViewModel> {
  if (options.latest && options.runId) {
    throw new SafeExitError("Use either --run or --latest, not both.");
  }
  const runs = await listRuns();
  if (runs.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      latestRunId: null,
      runDetails: [],
      runs: [],
      selectedRun: null,
    };
  }

  const selectedRunId = options.runId ?? runs[0].runId;
  const selectedRunExists = runs.some((run) => run.runId === selectedRunId);
  if (!selectedRunExists) {
    throw new SafeExitError(`Run not found: ${selectedRunId}`);
  }

  const recentStatuses = await Promise.all(
    runs.slice(0, RECENT_RUN_LIMIT).map((run) => readRunStatus(run.runId)),
  );
  const selectedStatus =
    recentStatuses.find((status) => status.run.runId === selectedRunId) ??
    (await readRunStatus(selectedRunId));
  const statuses = recentStatuses.some((status) => status.run.runId === selectedRunId)
    ? recentStatuses
    : [selectedStatus, ...recentStatuses];

  return {
    generatedAt: new Date().toISOString(),
    latestRunId: runs[0].runId,
    runDetails: statuses.map(selectedRun),
    runs: statuses.map(compactRun),
    selectedRun: selectedRun(selectedStatus),
  };
}

/**
 * Formats the operator desk model for non-interactive shells and tests.
 *
 * @param model - The operator desk model.
 * @returns Human-readable plain text.
 */
export function formatOperatorDeskPlain(model: OperatorDeskViewModel): string {
  if (!model.selectedRun) {
    return [
      "UykulukSciFi Operator Desk",
      `Generated: ${model.generatedAt}`,
      "",
      "No runs found.",
      "Next safe action: pnpm producer ideas",
    ].join("\n");
  }

  const run = model.selectedRun;
  return [
    "UykulukSciFi Operator Desk",
    `Generated: ${model.generatedAt}`,
    "",
    `Selected run: ${run.runId}`,
    `State: ${run.state}`,
    `Updated: ${run.updatedAt}`,
    `Evidence: ${run.evidenceStatus}`,
    `Readiness: ${run.readinessStatus}`,
    `Render decision: ${renderDecisionSummary(run.renderDecision)}`,
    `Approvals/artifacts/warnings: ${run.approvalCount} approvals, ${run.artifactCount} artifacts, ${run.warningCount} warnings`,
    `Blocked actions: ${run.blockedActionCount ?? "unknown"}`,
    "",
    "Next safe action:",
    `  ${run.nextRecommendedCommand}`,
    "",
    "Production media:",
    ...run.mediaArtifacts.map((artifact) => {
      const detail = artifact.detail ? ` (${artifact.detail})` : "";
      return `- ${artifact.label}: ${artifact.status}${detail}`;
    }),
    "",
    "Recent artifacts:",
    ...(run.recentArtifacts.length > 0
      ? run.recentArtifacts.map((artifact) => `- ${artifact}`)
      : ["- none"]),
    "",
    "Recent runs:",
    ...model.runs.map((candidate) => {
      const marker = candidate.runId === run.runId ? ">" : " ";
      return `${marker} ${candidate.runId}  ${candidate.state}  ${candidate.updatedAt}`;
    }),
  ].join("\n");
}

function compactRun(status: RunStatusSummary): OperatorDeskRun {
  return {
    approvalCount: status.approvalCount,
    artifactCount: status.artifactCount,
    blockedActionCount: status.blockedActionCount,
    evidenceStatus: status.evidenceStatus,
    nextRecommendedCommand: status.nextRecommendedCommand,
    readinessStatus: status.readiness.status,
    renderDecisionStatus: status.renderDecision.kind,
    runId: status.run.runId,
    state: status.run.state,
    updatedAt: status.run.updatedAt,
    warningCount: status.warningCount,
  };
}

function selectedRun(status: RunStatusSummary): OperatorDeskSelectedRun {
  return {
    ...compactRun(status),
    blockedActions: status.blockedActions,
    mediaArtifacts: status.mediaArtifacts,
    recentArtifacts: status.recentArtifacts,
    renderDecision: status.renderDecision,
  };
}

function renderDecisionSummary(decision: RenderDecisionStatus): string {
  if (decision.kind === "present") {
    return `${decision.decision.decision} by ${decision.decision.reviewedBy}`;
  }
  return decision.kind;
}
