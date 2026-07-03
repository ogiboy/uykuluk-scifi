import {
  privateUploadDisabledBlockedAction,
  publicPublishDisabledBlockedAction,
} from "../../../../src/stages/evidenceBlockedActions";
import type { StudioRunDetail } from "./runSummaries";

export type StudioRunReviewBrief = Readonly<{
  checkpoints: readonly StudioRunReviewBriefCheckpoint[];
  primaryAction: string;
  severity: "blocked" | "ready" | "review";
  summary: string;
  title: string;
}>;

export type StudioRunReviewBriefCheckpoint = Readonly<{
  detail: string;
  label: string;
  status: "attention" | "done" | "pending" | "ready";
}>;

type BriefInput = Pick<
  StudioRunDetail,
  | "blockedActionCount"
  | "blockedActions"
  | "channelHandoff"
  | "channelHandoffDecision"
  | "evidenceStatus"
  | "finalReviewBundle"
  | "nextRecommendedCommand"
  | "productionMedia"
  | "readinessStatus"
  | "renderDecision"
  | "state"
>;

/**
 * Builds the compact operator decision brief for Studio run detail.
 *
 * @param run - The current Studio run detail projection.
 * @returns A derived review brief; it does not own workflow state.
 */
export function buildStudioRunReviewBrief(run: BriefInput): StudioRunReviewBrief {
  const checkpoints = reviewBriefCheckpoints(run);
  const localBlockedActionCount = productionBlockingActionCount(run);
  if (localBlockedActionCount > 0) {
    return {
      checkpoints,
      primaryAction: nextAction(run),
      severity: "blocked",
      summary:
        "Resolve the projected local production blockers before trusting media, final review, or any later handoff. Upload and publish guards remain visible separately.",
      title: `${localBlockedActionCount} blocked action${localBlockedActionCount === 1 ? "" : "s"}`,
    };
  }
  if (run.state === "RENDERED" && run.renderDecision.kind !== "present") {
    return {
      checkpoints,
      primaryAction: nextAction(run),
      severity: "ready",
      summary:
        "Local draft media is ready for review. Record one durable operator decision after watching the draft.",
      title: "Draft review decision needed",
    };
  }
  if (run.renderDecision.kind === "present" && run.finalReviewBundle.kind !== "present") {
    return {
      checkpoints,
      primaryAction: nextAction(run),
      severity: "ready",
      summary:
        "The operator decision is recorded. Generate the local final review bundle before manual channel preparation.",
      title: "Final review bundle next",
    };
  }
  if (run.finalReviewBundle.kind === "present" && run.channelHandoff.kind !== "present") {
    return {
      checkpoints,
      primaryAction: nextAction(run),
      severity: "ready",
      summary:
        "The local final review handoff is ready. Prepare the manual channel package without upload or publish.",
      title: "Manual channel handoff next",
    };
  }
  if (run.channelHandoffDecision.kind === "present") {
    return {
      checkpoints,
      primaryAction: nextAction(run),
      severity: "review",
      summary:
        "The local manual channel package has a durable operator decision. Keep the selected media and metadata together for manual review; upload and publish remain guarded.",
      title: "Manual channel package ready",
    };
  }
  return {
    checkpoints,
    primaryAction: nextAction(run),
    severity: "review",
    summary:
      "Continue through the next safe CLI/core action. Studio summarizes local state but does not infer approval from files.",
    title: "Follow the next safe action",
  };
}

function productionBlockingActionCount(run: BriefInput): number {
  if (run.blockedActions.length === 0) {
    return run.blockedActionCount;
  }
  return run.blockedActions.filter((action) => !isExternalPublishingGuard(action)).length;
}

function isExternalPublishingGuard(action: string): boolean {
  return (
    action === privateUploadDisabledBlockedAction || action === publicPublishDisabledBlockedAction
  );
}

function reviewBriefCheckpoints(run: BriefInput): StudioRunReviewBrief["checkpoints"] {
  const passedMediaCount = run.productionMedia.filter(
    (artifact) => artifact.status === "pass",
  ).length;
  return [
    {
      detail: `Readiness is ${run.readinessStatus}.`,
      label: "Readiness",
      status: run.readinessStatus === "passed" ? "done" : "attention",
    },
    {
      detail: `Evidence is ${run.evidenceStatus}.`,
      label: "Evidence",
      status: run.evidenceStatus === "available" ? "done" : "attention",
    },
    {
      detail: `${passedMediaCount}/${run.productionMedia.length} media artifacts are verified by current evidence.`,
      label: "Media",
      status: mediaCheckpointStatus(passedMediaCount, run.productionMedia.length),
    },
    {
      detail: renderDecisionDetail(run),
      label: "Operator decision",
      status: renderDecisionCheckpointStatus(run),
    },
    {
      detail: finalHandoffDetail(run),
      label: "Final handoff",
      status: finalHandoffCheckpointStatus(run),
    },
  ];
}

function mediaCheckpointStatus(
  passedMediaCount: number,
  totalMediaCount: number,
): StudioRunReviewBriefCheckpoint["status"] {
  if (totalMediaCount === 0) {
    return "pending";
  }
  if (passedMediaCount === totalMediaCount) {
    return "done";
  }
  return passedMediaCount > 0 ? "ready" : "pending";
}

function renderDecisionCheckpointStatus(run: BriefInput): StudioRunReviewBriefCheckpoint["status"] {
  if (run.renderDecision.kind === "present") {
    return "done";
  }
  if (run.renderDecision.kind === "invalid" || run.renderDecision.kind === "stale") {
    return "attention";
  }
  return "pending";
}

function finalHandoffCheckpointStatus(run: BriefInput): StudioRunReviewBriefCheckpoint["status"] {
  if (run.channelHandoffDecision.kind === "present") {
    return "done";
  }
  if (
    run.channelHandoffDecision.kind === "invalid" ||
    run.channelHandoffDecision.kind === "stale" ||
    run.channelHandoff.kind === "invalid" ||
    run.channelHandoff.kind === "stale" ||
    run.finalReviewBundle.kind === "invalid" ||
    run.finalReviewBundle.kind === "stale"
  ) {
    return "attention";
  }
  if (run.channelHandoff.kind === "present" || run.finalReviewBundle.kind === "present") {
    return "ready";
  }
  return "pending";
}

function renderDecisionDetail(run: BriefInput): string {
  if (run.renderDecision.kind === "present") {
    return run.renderDecision.message;
  }
  if (run.renderDecision.kind === "invalid" || run.renderDecision.kind === "stale") {
    return run.renderDecision.message;
  }
  return "No local draft-render decision is recorded yet.";
}

function finalHandoffDetail(run: BriefInput): string {
  if (run.channelHandoffDecision.kind === "present") {
    return run.channelHandoffDecision.message;
  }
  if (run.channelHandoff.kind === "present") {
    return "Manual channel handoff is ready for a local decision.";
  }
  if (run.finalReviewBundle.kind === "present") {
    return "Final review bundle is ready for manual channel handoff preparation.";
  }
  return "Final review and manual channel handoff are not complete yet.";
}

function nextAction(run: BriefInput): string {
  return run.nextRecommendedCommand ?? "No safe next action is available from current evidence.";
}
