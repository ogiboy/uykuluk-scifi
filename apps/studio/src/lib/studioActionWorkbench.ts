import type { StudioApprovalActionConfig } from "./studioApprovalAction";
import { approvalActionForRun } from "./studioApprovalAction";
import type { StudioRunDetail } from "./runSummaries";

export type StudioActionWorkbenchTone =
  "attention" | "available" | "blocked" | "cli-only" | "complete";

export type StudioActionWorkbenchPrimary = Readonly<{
  command: string | null;
  description: string;
  label: string;
  routePath: string | null;
  tone: StudioActionWorkbenchTone;
}>;

export type StudioActionWorkbenchBoundary = Readonly<{
  detail: string;
  label: string;
}>;

export type StudioActionWorkbench = Readonly<{
  boundaries: readonly StudioActionWorkbenchBoundary[];
  primary: StudioActionWorkbenchPrimary;
}>;

export type StudioActionWorkbenchCounts = Readonly<{
  blockedCli: number;
  cliOnly: number;
  complete: number;
  webAction: number;
}>;

export type StudioActionWorkbenchRun = Pick<
  StudioRunDetail,
  "blockedActionCount" | "nextRecommendedCommand" | "readinessStatus" | "runId" | "state"
> &
  Readonly<{
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
  return {
    boundaries: actionWorkbenchBoundaries(run.runId),
    primary: primaryWorkbenchAction(run),
  };
}

/**
 * Counts action-workbench categories for an operator queue projection.
 *
 * @param runs - Run summaries or details shown in the current queue.
 * @returns Counts for guarded web actions, blocked CLI recovery, CLI-only actions, and no-action states.
 */
export function countStudioActionWorkbench(
  runs: readonly StudioActionWorkbenchRun[],
): StudioActionWorkbenchCounts {
  return runs.reduce<StudioActionWorkbenchCounts>(
    (counts, run) => {
      const tone = buildStudioActionWorkbench(run).primary.tone;
      if (tone === "available") {
        return { ...counts, webAction: counts.webAction + 1 };
      }
      if (tone === "blocked") {
        return { ...counts, blockedCli: counts.blockedCli + 1 };
      }
      if (tone === "cli-only" || tone === "attention") {
        return { ...counts, cliOnly: counts.cliOnly + 1 };
      }
      return { ...counts, complete: counts.complete + 1 };
    },
    {
      blockedCli: 0,
      cliOnly: 0,
      complete: 0,
      webAction: 0,
    },
  );
}

function primaryWorkbenchAction(run: StudioActionWorkbenchRun): StudioActionWorkbenchPrimary {
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

function approvalWorkbenchAction(
  action: StudioApprovalActionConfig,
  run: StudioActionWorkbenchRun,
): StudioActionWorkbenchPrimary {
  return {
    command: run.nextRecommendedCommand,
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
