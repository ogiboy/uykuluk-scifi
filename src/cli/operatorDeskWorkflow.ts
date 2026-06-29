import { orderedStates, type RunState } from "../core/state.js";
import type { RenderDecisionStatus } from "../stages/renderDecisionStatus.js";
import type { RunStatusSummary } from "../stages/status.js";
import type { ProductionMediaStatus } from "../stages/statusMedia.js";

export type OperatorDeskWorkflowStepStatus = "blocked" | "current" | "done" | "pending";

export type OperatorDeskWorkflowStep = {
  detail: string;
  label: string;
  status: OperatorDeskWorkflowStepStatus;
};

/**
 * Builds the operator workflow progress shown in the local desk.
 *
 * This is a read-only projection of the CLI/core state, readiness, media evidence, approvals, and render-decision status.
 *
 * @param summary - The shared run status summary used by status and Studio services.
 * @returns Ordered workflow progress rows for the v1 local production loop.
 */
export function buildOperatorDeskWorkflowProgress(
  summary: RunStatusSummary,
): OperatorDeskWorkflowStep[] {
  const media = mediaByKey(summary.mediaArtifacts);
  return [
    stateStep(summary.run.state, "Ideas", "IDEAS_GENERATED", "NEW", "Generate ideas."),
    stateStep(
      summary.run.state,
      "Idea approval",
      "IDEA_APPROVED",
      "IDEAS_GENERATED",
      "Approve one idea.",
    ),
    stateStep(
      summary.run.state,
      "Script draft",
      "SCRIPT_GENERATED",
      "IDEA_APPROVED",
      "Generate the script.",
    ),
    stateStep(
      summary.run.state,
      "Script review",
      "SCRIPT_REVIEWED",
      "SCRIPT_GENERATED",
      "Review script blockers and warnings.",
    ),
    stateStep(
      summary.run.state,
      "Script approval",
      "SCRIPT_APPROVED",
      "SCRIPT_REVIEWED",
      "Approve the reviewed script digest.",
    ),
    stateStep(
      summary.run.state,
      "Production package",
      "PRODUCTION_PACKAGE_GENERATED",
      "SCRIPT_APPROVED",
      "Generate the production package.",
    ),
    mediaStep(
      "Render plan",
      media.renderPlan,
      stateAtLeast(summary.run.state, "PRODUCTION_PACKAGE_GENERATED"),
      "Generate and review the contact sheet.",
    ),
    readinessStep(summary),
    mediaStep(
      "Voiceover",
      media.voiceoverAudio,
      summary.readiness.status === "passed",
      "Generate and review local audio.",
    ),
    renderApprovalStep(summary, media.voiceoverAudio),
    mediaStep(
      "Draft render",
      media.draftRender,
      stateAtLeast(summary.run.state, "RENDER_APPROVED"),
      "Render the local MP4 draft.",
    ),
    renderDecisionStep(summary.renderDecision, summary.run.state),
  ];
}

function stateStep(
  currentState: RunState,
  label: string,
  doneState: RunState,
  activeState: RunState,
  detail: string,
): OperatorDeskWorkflowStep {
  if (currentState === "FAILED") {
    return { detail: "Run failed before this gate completed.", label, status: "blocked" };
  }
  if (stateAtLeast(currentState, doneState)) {
    return { detail: "Completed.", label, status: "done" };
  }
  return {
    detail,
    label,
    status: currentState === activeState ? "current" : "pending",
  };
}

function mediaStep(
  label: string,
  media: ProductionMediaStatus | undefined,
  canStart: boolean,
  detail: string,
): OperatorDeskWorkflowStep {
  if (media?.status === "pass") {
    return { detail: "Verified by current evidence.", label, status: "done" };
  }
  if (media?.status === "block") {
    return {
      detail: media.detail ?? "Current evidence blocks this media artifact.",
      label,
      status: "blocked",
    };
  }
  return { detail, label, status: canStart ? "current" : "pending" };
}

function readinessStep(summary: RunStatusSummary): OperatorDeskWorkflowStep {
  if (summary.readiness.status === "passed") {
    return {
      detail: "Evidence and readiness are current.",
      label: "Estimate/evidence/readiness",
      status: "done",
    };
  }
  if (
    summary.readiness.status === "blocked" ||
    summary.readiness.status === "invalid" ||
    summary.readiness.status === "stale"
  ) {
    return {
      detail: "Resolve readiness attention before local voice/render work.",
      label: "Estimate/evidence/readiness",
      status: "blocked",
    };
  }
  return {
    detail: "Generate the cost estimate, evidence bundle, and readiness report.",
    label: "Estimate/evidence/readiness",
    status: stateAtLeast(summary.run.state, "PRODUCTION_PACKAGE_GENERATED") ? "current" : "pending",
  };
}

function renderApprovalStep(
  summary: RunStatusSummary,
  voiceover: ProductionMediaStatus | undefined,
): OperatorDeskWorkflowStep {
  if (stateAtLeast(summary.run.state, "RENDER_APPROVED")) {
    return { detail: "Render approval is recorded.", label: "Render approval", status: "done" };
  }
  if (summary.run.state === "READY_FOR_MANUAL_PRODUCTION" && voiceover?.status === "pass") {
    return {
      detail: "Approve the exact current render inputs before rendering.",
      label: "Render approval",
      status: "current",
    };
  }
  return {
    detail: "Wait for voiceover review and readiness.",
    label: "Render approval",
    status: "pending",
  };
}

function renderDecisionStep(
  decision: RenderDecisionStatus,
  state: RunState,
): OperatorDeskWorkflowStep {
  if (decision.kind === "present") {
    return {
      detail: "Local draft decision is recorded.",
      label: "Operator decision",
      status: "done",
    };
  }
  if (decision.kind === "invalid" || decision.kind === "stale") {
    return { detail: decision.message, label: "Operator decision", status: "blocked" };
  }
  return {
    detail: "Record the operator decision after local draft review.",
    label: "Operator decision",
    status: state === "RENDERED" ? "current" : "pending",
  };
}

function mediaByKey(mediaArtifacts: readonly ProductionMediaStatus[]): {
  draftRender?: ProductionMediaStatus;
  renderPlan?: ProductionMediaStatus;
  voiceoverAudio?: ProductionMediaStatus;
} {
  return Object.fromEntries(mediaArtifacts.map((artifact) => [artifact.evidenceKey, artifact]));
}

function stateAtLeast(currentState: RunState, targetState: RunState): boolean {
  return orderedStates.indexOf(currentState) >= orderedStates.indexOf(targetState);
}
