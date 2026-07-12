import type { StudioArtifactPreview } from "../artifacts/artifactPreviews";
import type { StudioRunDetail } from "../runSummaries";
import { artifactReviewActionsForRun } from "./renderPlanReviewAction";
import type { StudioApprovalActionConfig } from "./studioApprovalAction";
import { approvalActionForRun, approvalCommandForRun } from "./studioApprovalAction";
import { stageActionForRun } from "./studioStageAction";

export type StudioActionWorkbenchTone =
  "attention" | "available" | "blocked" | "cli-only" | "complete";

export type StudioActionWorkbenchPrimary = Readonly<{
  command: string | null;
  description: string;
  label: string;
  routePath: string | null;
  tone: StudioActionWorkbenchTone;
}>;

export type StudioActionWorkbenchBoundary = Readonly<{ detail: string; label: string }>;

export type StudioActionWorkbench = Readonly<{
  boundaries: readonly StudioActionWorkbenchBoundary[];
  primary: StudioActionWorkbenchPrimary;
}>;

export type StudioActionWorkbenchRun = Pick<
  StudioRunDetail,
  "blockedActionCount" | "nextRecommendedCommand" | "readinessStatus" | "runId" | "state"
> &
  Readonly<{
    artifacts?: readonly Pick<StudioArtifactPreview, "exists" | "path">[];
    channelHandoff: Pick<StudioRunDetail["channelHandoff"], "kind">;
    channelHandoffDecision: Pick<StudioRunDetail["channelHandoffDecision"], "kind" | "nextAction">;
    renderDecision: Pick<StudioRunDetail["renderDecision"], "kind" | "nextAction">;
    renderDecisionCommands?: readonly Pick<
      StudioRunDetail["renderDecisionCommands"][number],
      "command"
    >[];
  }>;

/**
 * Builds the operator-facing Studio action workbench summary for one run.
 *
 * The summary is presentation-only. Server routes and CLI/core contracts continue to own all
 * validation, approval, cost, evidence, and transition enforcement.
 *
 * @param run - The Studio run projection used by the run detail page.
 * @returns The primary available action and permanent safety boundaries.
 */
export function buildStudioActionWorkbench(run: StudioActionWorkbenchRun): StudioActionWorkbench {
  return { boundaries: actionWorkbenchBoundaries(run.runId), primary: primaryWorkbenchAction(run) };
}

function primaryWorkbenchAction(run: StudioActionWorkbenchRun): StudioActionWorkbenchPrimary {
  const artifactReviewAction = primaryArtifactReviewAction(run);
  if (artifactReviewAction) {
    return artifactReviewAction;
  }
  const approvalAction = approvalActionForRun(run);
  if (approvalAction) {
    return approvalWorkbenchAction(approvalAction, run);
  }
  const renderDecisionCommand = nextRenderDecisionCommand(run);
  if (renderDecisionCommand) {
    return {
      command: renderDecisionCommand,
      description:
        "A local draft render is ready for an explicit operator decision. The decision writes review evidence only.",
      label: "Record render decision",
      routePath: "/actions/decide-render",
      tone: "available",
    };
  }
  if (channelHandoffDecisionAvailable(run)) {
    return {
      command: run.channelHandoffDecision.nextAction,
      description:
        "Manual channel-prep evidence is ready for a local handoff decision. This still does not upload media.",
      label: "Record channel handoff decision",
      routePath: "/actions/decide-channel-handoff",
      tone: "available",
    };
  }
  const stageAction = stageActionForRun(run);
  if (stageAction) {
    return {
      command: run.nextRecommendedCommand,
      description: `${stageAction.description} Studio will call the guarded local route and the producer CLI will re-check all workflow gates.`,
      label: stageAction.heading,
      routePath: stageAction.routePath,
      tone: "available",
    };
  }
  if (isGlobalIdeasCommand(run.nextRecommendedCommand)) {
    return {
      command: null,
      description:
        "The ideas command creates a separate local run instead of advancing this persisted run. Use the Start idea run control from the control desk or runs page when you want a new idea-generation run.",
      label: "No run-bound action",
      routePath: null,
      tone: "attention",
    };
  }
  if (run.nextRecommendedCommand) {
    return {
      command: run.nextRecommendedCommand,
      description:
        "The next safe step is currently CLI-only or read-only. Use the command below and return to Studio for review.",
      label: "CLI next action",
      routePath: null,
      tone: run.blockedActionCount > 0 ? "blocked" : "cli-only",
    };
  }
  return {
    command: null,
    description:
      run.renderDecision.kind === "present" || run.channelHandoffDecision.kind === "present"
        ? "The latest local decision evidence is recorded. Review the persisted artifacts before any future upload work."
        : "No guarded Studio action is currently available for this run.",
    label: "No web action available",
    routePath: null,
    tone: run.readinessStatus === "blocked" ? "blocked" : "complete",
  };
}

function primaryArtifactReviewAction(
  run: StudioActionWorkbenchRun,
): StudioActionWorkbenchPrimary | null {
  if (!run.artifacts) {
    return null;
  }
  const action = artifactReviewActionsForRun({
    artifacts: run.artifacts,
    nextRecommendedCommand: run.nextRecommendedCommand,
    runId: run.runId,
    state: run.state,
  }).find((candidate) => candidate.actionId === primaryArtifactReviewActionId(run));
  return action
    ? {
        command: action.command,
        description: `${action.details} This review does not advance workflow state, but it should happen before the next state-changing production step.`,
        label: action.heading,
        routePath: action.routePath,
        tone: "available",
      }
    : null;
}

function primaryArtifactReviewActionId(
  run: StudioActionWorkbenchRun,
): "render.review" | "render-plan.review" | "voice.review" | null {
  if (run.state === "PRODUCTION_PACKAGE_GENERATED" || run.state === "COST_ESTIMATED") {
    return "render-plan.review";
  }
  if (run.state === "READY_FOR_MANUAL_PRODUCTION") {
    return "voice.review";
  }
  if (run.state === "RENDERED" && run.renderDecision.kind !== "present") {
    return "render.review";
  }
  return null;
}

function approvalWorkbenchAction(
  action: StudioApprovalActionConfig,
  run: StudioActionWorkbenchRun,
): StudioActionWorkbenchPrimary {
  return {
    command: approvalCommandForRun(action, run.runId, run.nextRecommendedCommand),
    description: `${action.description} Studio will call the matching guarded local route and the server will re-check the current run state.`,
    label: action.heading,
    routePath: action.routePath,
    tone: "available",
  };
}

function channelHandoffDecisionAvailable(run: StudioActionWorkbenchRun): boolean {
  return run.channelHandoff.kind === "present" && run.channelHandoffDecision.kind === "missing";
}

function nextRenderDecisionCommand(run: StudioActionWorkbenchRun): string | null {
  if (run.state !== "RENDERED" || run.renderDecision.kind === "present") {
    return null;
  }
  return run.renderDecisionCommands?.[0]?.command ?? run.renderDecision.nextAction ?? null;
}

function actionWorkbenchBoundaries(runId: string): StudioActionWorkbenchBoundary[] {
  return [
    {
      detail: `Run ${runId} remains bound to CLI/core state, approval, readiness, and evidence contracts.`,
      label: "Source of truth",
    },
    {
      detail: "Each web action requires the guarded local session and same-origin JSON route.",
      label: "Local session",
    },
    {
      detail:
        "Upload, scheduling, public publish, and paid provider execution remain unavailable here.",
      label: "Disabled actions",
    },
  ];
}

function isGlobalIdeasCommand(command: string | null): boolean {
  if (!command) {
    return false;
  }
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  const prefix = ["pnpm", "producer", "ideas"];
  return (
    prefix.every((token, index) => tokens[index] === token) &&
    tokens.slice(prefix.length).every((token) => token === "--json")
  );
}
