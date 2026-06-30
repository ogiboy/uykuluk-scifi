import { SafeExitError } from "../core/errors.js";
import { listRuns } from "../core/runStore.js";
import type { RunState } from "../core/state.js";
import type { RenderDecisionStatus } from "../stages/renderDecisionStatus.js";
import { readRunStatus, type RunStatusSummary } from "../stages/status.js";
import { formatProductionMediaStatus, type ProductionMediaStatus } from "../stages/statusMedia.js";
import {
  formatOperatorDeskBlockedActionLines,
  formatOperatorDeskReadinessLines,
  formatOperatorDeskRecentArtifactLines,
  formatOperatorDeskWorkflowLines,
} from "./operatorDeskFormatting.js";
import { buildStatusWorkflowProgress, type StatusWorkflowStep } from "../stages/statusWorkflow.js";

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
  renderDecisionStatus: string;
  runId: string;
  state: RunState;
  updatedAt: string;
  warningCount: number;
};

export type OperatorDeskCommand = {
  command: string;
  label: string;
};

export type OperatorDeskSelectedRun = OperatorDeskRun & {
  blockedActions: string[];
  commandQueue: OperatorDeskCommand[];
  diagnostics: RunStatusSummary["diagnostics"];
  mediaArtifacts: RunStatusSummary["mediaArtifacts"];
  readiness: RunStatusSummary["readiness"];
  recentArtifacts: string[];
  renderDecision: RenderDecisionStatus;
  workflowProgress: StatusWorkflowStep[];
};

export type OperatorDeskViewModel = {
  generatedAt: string;
  latestRunId: string | null;
  runDetails: OperatorDeskSelectedRun[];
  runs: OperatorDeskRun[];
  selectedRun: OperatorDeskSelectedRun | null;
};

/**
 * Builds the operator desk view model from persisted run state and status summaries.
 *
 * @param options - Selection options for the desk.
 * @returns A view model containing the latest run, recent runs, and the selected run details.
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
 * Formats an operator desk view model as plain text.
 *
 * @param model - The operator desk view model to format.
 * @returns The formatted plain-text output.
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
    ...formatOperatorDeskReadinessLines(run.readiness),
    `Render decision: ${renderDecisionSummary(run.renderDecision)}`,
    ...renderDecisionReviewLines(run.renderDecision),
    `Approvals/artifacts/warnings: ${run.approvalCount} approvals, ${run.artifactCount} artifacts, ${run.warningCount} warnings`,
    `Blocked actions: ${run.blockedActionCount ?? "unknown"}`,
    ...formatOperatorDeskBlockedActionLines(run.blockedActions),
    ...formatOperatorDeskDiagnosticLines(run.diagnostics),
    "",
    ...formatOperatorDeskWorkflowLines(run.workflowProgress),
    "",
    "Next safe action:",
    `  ${run.nextRecommendedCommand}`,
    "",
    ...formatOperatorDeskCommandLines(run.commandQueue),
    "",
    "Production media:",
    ...run.mediaArtifacts.map(formatOperatorDeskMediaArtifactLine),
    "",
    ...formatOperatorDeskRecentArtifactLines(run.recentArtifacts),
    "",
    "Recent runs:",
    ...model.runs.map((candidate) => {
      const marker = candidate.runId === run.runId ? ">" : " ";
      return `${marker} ${candidate.runId}  ${candidate.state}  ${candidate.updatedAt}  decision:${candidate.renderDecisionStatus}`;
    }),
  ].join("\n");
}

/**
 * Formats a production media row for the operator desk.
 *
 * @param artifact - The media artifact summary to format.
 * @returns A single display line, including the local review command when one exists.
 */
export function formatOperatorDeskMediaArtifactLine(artifact: ProductionMediaStatus): string {
  const review = artifact.reviewCommand ? ` | Review command: ${artifact.reviewCommand}` : "";
  return `${formatProductionMediaStatus(artifact)}${review}`;
}

/**
 * Formats the copyable operator command queue for desk output.
 *
 * @param commands - Commands derived from the current status summary.
 * @returns Lines for the operator command section.
 */
export function formatOperatorDeskCommandLines(commands: readonly OperatorDeskCommand[]): string[] {
  if (commands.length === 0) {
    return ["Operator commands:", "- none"];
  }
  return ["Operator commands:", ...commands.map((item) => `- ${item.label}: ${item.command}`)];
}

/**
 * Formats safe provider/stage diagnostics for the operator desk.
 *
 * @param diagnostics - Current run diagnostic summaries.
 * @returns Lines for the diagnostics section.
 */
export function formatOperatorDeskDiagnosticLines(
  diagnostics: readonly RunStatusSummary["diagnostics"][number][],
): string[] {
  if (diagnostics.length === 0) {
    return ["Diagnostics: none"];
  }
  return [
    "Diagnostics:",
    ...diagnostics.map(
      (diagnostic) => `- ${diagnostic.path} [${diagnostic.stage}]: ${diagnostic.message}`,
    ),
  ];
}

/**
 * Creates a compact run summary for the operator desk view.
 *
 * @param status - The run status summary to convert
 * @returns A compact run record with counts, statuses, command, and run identity fields
 */
function compactRun(status: RunStatusSummary): OperatorDeskRun {
  return {
    approvalCount: status.approvalCount,
    artifactCount: status.artifactCount,
    blockedActionCount: status.blockedActionCount,
    evidenceStatus: status.evidenceStatus,
    nextRecommendedCommand: status.nextRecommendedCommand,
    readinessStatus: status.readiness.status,
    renderDecisionStatus: renderDecisionSummary(status.renderDecision),
    runId: status.run.runId,
    state: status.run.state,
    updatedAt: status.run.updatedAt,
    warningCount: status.warningCount,
  };
}

/**
 * Builds the selected-run view model from a run status summary.
 *
 * @param status - The run status summary to convert.
 * @returns The selected-run view model with full blocked actions, media artifacts, recent artifacts, and render decision details.
 */
function selectedRun(status: RunStatusSummary): OperatorDeskSelectedRun {
  return {
    ...compactRun(status),
    blockedActions: status.blockedActions,
    commandQueue: operatorCommandQueue(status),
    diagnostics: status.diagnostics,
    mediaArtifacts: status.mediaArtifacts,
    readiness: status.readiness,
    recentArtifacts: status.recentArtifacts,
    renderDecision: status.renderDecision,
    workflowProgress: buildStatusWorkflowProgress({
      mediaArtifacts: status.mediaArtifacts,
      readinessStatus: status.readiness.status,
      renderDecision: status.renderDecision,
      state: status.run.state,
    }),
  };
}

/**
 * Summarizes a render decision for display.
 *
 * @param decision - The render decision status to summarize
 * @returns A display string for the render decision
 */
function renderDecisionSummary(decision: RenderDecisionStatus): string {
  if (decision.kind === "present") {
    return `${decision.decision.decision} by ${decision.decision.reviewedBy}`;
  }
  return decision.kind;
}

function renderDecisionReviewLines(decision: RenderDecisionStatus): string[] {
  return decision.kind === "present" ? [`Render decision review: ${decision.reviewCommand}`] : [];
}

function operatorCommandQueue(status: RunStatusSummary): OperatorDeskCommand[] {
  const commands: OperatorDeskCommand[] = [];
  const seen = new Set<string>();

  const addCommand = (label: string, command: string | null | undefined) => {
    if (!isCopyableProducerCommand(command) || seen.has(command)) {
      return;
    }
    seen.add(command);
    commands.push({ command, label });
  };

  addCommand("Next safe action", status.nextRecommendedCommand);
  addReadinessCommands(status.readiness, addCommand);
  addMediaCommands(status, addCommand);
  addRenderDecisionCommands(status.renderDecision, addCommand);

  return commands;
}

function addReadinessCommands(
  readiness: RunStatusSummary["readiness"],
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  switch (readiness.status) {
    case "missing":
    case "invalid":
    case "stale":
      addCommand("Readiness", readiness.nextAction);
      return;
    case "blocked":
    case "passed":
      for (const check of readiness.attention) {
        addCommand(`Readiness ${check.name}`, check.nextAction);
      }
  }
}

function addMediaCommands(
  status: RunStatusSummary,
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  for (const artifact of status.mediaArtifacts) {
    addCommand(`Review ${lowercaseFirst(artifact.label)}`, artifact.reviewCommand);
    if (status.run.state === "READY_FOR_MANUAL_PRODUCTION") {
      addCommand(renderApprovalLabel(artifact.renderApprovalScope), artifact.renderApprovalCommand);
    }
  }
}

function addRenderDecisionCommands(
  decision: RenderDecisionStatus,
  addCommand: (label: string, command: string | null | undefined) => void,
): void {
  if (decision.kind === "present") {
    addCommand("Review render decision", decision.reviewCommand);
    return;
  }
  addCommand("Render decision", decision.nextAction);
}

function renderApprovalLabel(scope: ProductionMediaStatus["renderApprovalScope"]): string {
  return scope === "timing-draft-only" ? "Approve timing-draft render" : "Approve render";
}

function isCopyableProducerCommand(command: string | null | undefined): command is string {
  return typeof command === "string" && command.startsWith("pnpm producer ");
}

function lowercaseFirst(value: string): string {
  return value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}
