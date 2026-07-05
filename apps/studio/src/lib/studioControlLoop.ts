import type { StatusWorkflowStep } from "../../../../src/stages/statusWorkflow";
import type { StudioRunDetail } from "./runSummaries";
import {
  buildStudioActionWorkbench,
  type StudioActionWorkbenchPrimary,
  type StudioActionWorkbenchRun,
} from "./studioActionWorkbench";

export type StudioControlLoopTone = "blocked" | "cli-only" | "complete" | "web-action";

export type StudioControlLoopItem = Readonly<{
  detail: string;
  label: string;
  tone: "attention" | "blocked" | "done" | "neutral" | "ready";
}>;

export type StudioControlLoop = Readonly<{
  currentStep: StatusWorkflowStep | null;
  items: readonly StudioControlLoopItem[];
  nextAction: StudioActionWorkbenchPrimary;
  summary: string;
  title: string;
  tone: StudioControlLoopTone;
}>;

export type StudioControlLoopRun = StudioActionWorkbenchRun &
  Pick<
    StudioRunDetail,
    | "blockedActionCount"
    | "evidenceMessage"
    | "evidenceStatus"
    | "readinessMessage"
    | "readinessStatus"
    | "runId"
    | "state"
    | "workflowProgress"
  >;

/**
 * Builds one operator-facing control-loop projection for Studio home and run detail surfaces.
 *
 * This is a read/presentation projection only. Guarded routes and CLI/core still own mutations,
 * approvals, cost checks, evidence validation, provider execution, upload, and publish safety.
 *
 * @param run - The Studio run projection used to summarize the current safe control loop.
 * @returns A compact control-loop decision model for operator UI.
 */
export function buildStudioControlLoop(run: StudioControlLoopRun): StudioControlLoop {
  const workbench = buildStudioActionWorkbench(run);
  const tone = controlLoopTone(workbench.primary.tone);
  const currentStep = currentWorkflowStep(run.workflowProgress);

  return {
    currentStep,
    items: controlLoopItems(run),
    nextAction: workbench.primary,
    summary: controlLoopSummary(tone, workbench.primary, currentStep),
    title: "Guided production loop",
    tone,
  };
}

function controlLoopTone(tone: StudioActionWorkbenchPrimary["tone"]): StudioControlLoopTone {
  if (tone === "available") {
    return "web-action";
  }
  if (tone === "blocked") {
    return "blocked";
  }
  if (tone === "cli-only" || tone === "attention") {
    return "cli-only";
  }
  return "complete";
}

function currentWorkflowStep(
  workflowProgress: readonly StatusWorkflowStep[],
): StatusWorkflowStep | null {
  return (
    workflowProgress.find((step) => step.status === "blocked") ??
    workflowProgress.find((step) => step.status === "current") ??
    workflowProgress.find((step) => step.status === "pending") ??
    null
  );
}

function controlLoopSummary(
  tone: StudioControlLoopTone,
  action: StudioActionWorkbenchPrimary,
  currentStep: StatusWorkflowStep | null,
): string {
  if (tone === "web-action") {
    return `${action.label} is available from Studio. The guarded route will re-check CLI/core state before writing local evidence.`;
  }
  if (tone === "blocked") {
    return "The next step is blocked or requires manual recovery before Studio should continue.";
  }
  if (tone === "cli-only") {
    return "The next safe step is visible, but this action still needs CLI/manual handling.";
  }
  if (currentStep) {
    return `Current workflow focus is ${currentStep.label.toLowerCase()}. Review persisted evidence before continuing.`;
  }
  return "No immediate local action is required for this run.";
}

function controlLoopItems(run: StudioControlLoopRun): StudioControlLoopItem[] {
  return [
    {
      detail: `Current persisted state is ${run.state}.`,
      label: "Run state",
      tone: run.state === "FAILED" ? "blocked" : "done",
    },
    {
      detail: run.readinessMessage,
      label: "Readiness",
      tone: run.readinessStatus === "passed" ? "done" : "attention",
    },
    {
      detail: run.evidenceMessage,
      label: "Evidence",
      tone: run.evidenceStatus === "available" ? "done" : "attention",
    },
    {
      detail: blockedActionsDetail(run.blockedActionCount),
      label: "Blocked actions",
      tone: run.blockedActionCount === 0 ? "done" : "blocked",
    },
    {
      detail:
        "Upload, scheduling, public publish, and paid provider execution are not exposed here.",
      label: "Disabled actions",
      tone: "done",
    },
  ];
}

function blockedActionsDetail(blockedActionCount: number): string {
  if (blockedActionCount === 0) {
    return "No blocked actions are projected by current evidence.";
  }
  const noun = blockedActionCount === 1 ? "action" : "actions";
  return `${blockedActionCount} blocked ${noun} remain visible.`;
}
