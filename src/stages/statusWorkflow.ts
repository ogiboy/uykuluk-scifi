import { orderedStates, type RunState } from "../core/state.js";
import type { ProductionMediaStatus } from "./statusMediaSummary.js";
import type {
  StatusWorkflowArtifactStatus,
  StatusWorkflowInput,
  StatusWorkflowRenderDecision,
  StatusWorkflowStep,
} from "./statusWorkflowTypes.js";

export type {
  StatusWorkflowArtifactStatus,
  StatusWorkflowInput,
  StatusWorkflowRenderDecision,
  StatusWorkflowStep,
  StatusWorkflowStepStatus,
} from "./statusWorkflowTypes.js";

/**
 * Builds read-only progress rows for the v1 local production workflow.
 *
 * This projection consumes the canonical run state plus current readiness/media/decision summaries;
 * it does not own transitions or infer approvals from files.
 *
 * @param input - Current run state and status summaries.
 * @returns Ordered workflow progress rows for operator surfaces.
 */
export function buildStatusWorkflowProgress(input: StatusWorkflowInput): StatusWorkflowStep[] {
  const media = mediaByKey(input.mediaArtifacts);
  const state = input.state;
  return [
    stateStep(state, "Ideas", "IDEAS_GENERATED", "NEW", "Generate ideas."),
    stateStep(state, "Idea approval", "IDEA_APPROVED", "IDEAS_GENERATED", "Approve one idea."),
    stateStep(state, "Script draft", "SCRIPT_GENERATED", "IDEA_APPROVED", "Generate the script."),
    stateStep(
      state,
      "Script review",
      "SCRIPT_REVIEWED",
      "SCRIPT_GENERATED",
      "Review script blockers and warnings.",
    ),
    stateStep(
      state,
      "Script approval",
      "SCRIPT_APPROVED",
      "SCRIPT_REVIEWED",
      "Approve the reviewed script digest.",
    ),
    stateStep(
      state,
      "Production package",
      "PRODUCTION_PACKAGE_GENERATED",
      "SCRIPT_APPROVED",
      "Generate the production package.",
    ),
    mediaStep(
      "Render plan",
      media.renderPlan,
      stateAtLeast(state, "PRODUCTION_PACKAGE_GENERATED"),
      "Generate and review the contact sheet.",
    ),
    readinessStep(input),
    mediaStep(
      "Voiceover",
      media.voiceoverAudio,
      input.readinessStatus === "passed",
      "Generate and review local audio.",
    ),
    renderApprovalStep(state, media.voiceoverAudio),
    mediaStep(
      "Draft render",
      media.draftRender,
      stateAtLeast(state, "RENDER_APPROVED"),
      "Render the local MP4 draft.",
    ),
    renderDecisionStep(input.renderDecision, state),
    finalReviewStep(input.finalReviewBundle, input.renderDecision),
    channelHandoffStep(input.channelHandoff, input.finalReviewBundle),
  ];
}

function stateStep(
  currentState: RunState,
  label: string,
  doneState: RunState,
  activeState: RunState,
  detail: string,
): StatusWorkflowStep {
  if (currentState === "FAILED") {
    return { detail: "Run failed before this gate completed.", label, status: "blocked" };
  }
  if (stateAtLeast(currentState, doneState)) {
    return { detail: "Completed.", label, status: "done" };
  }
  return { detail, label, status: currentState === activeState ? "current" : "pending" };
}

function mediaStep(
  label: string,
  media: ProductionMediaStatus | undefined,
  canStart: boolean,
  detail: string,
): StatusWorkflowStep {
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

function readinessStep(input: StatusWorkflowInput): StatusWorkflowStep {
  if (input.readinessStatus === "passed") {
    return {
      detail: "Evidence and readiness are current.",
      label: "Estimate/evidence/readiness",
      status: "done",
    };
  }
  if (["blocked", "invalid", "stale"].includes(input.readinessStatus)) {
    return {
      detail: "Resolve readiness attention before local voice/render work.",
      label: "Estimate/evidence/readiness",
      status: "blocked",
    };
  }
  return {
    detail: "Generate the cost estimate, evidence bundle, and readiness report.",
    label: "Estimate/evidence/readiness",
    status: stateAtLeast(input.state, "PRODUCTION_PACKAGE_GENERATED") ? "current" : "pending",
  };
}

function renderApprovalStep(
  state: RunState,
  voiceover: ProductionMediaStatus | undefined,
): StatusWorkflowStep {
  if (stateAtLeast(state, "RENDER_APPROVED")) {
    return { detail: "Render approval is recorded.", label: "Render approval", status: "done" };
  }
  if (state === "READY_FOR_MANUAL_PRODUCTION" && voiceover?.status === "pass") {
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
  decision: StatusWorkflowRenderDecision,
  state: RunState,
): StatusWorkflowStep {
  if (decision.kind === "present") {
    return {
      detail: decision.message ?? "Local draft decision is recorded.",
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

function finalReviewStep(
  finalReview: StatusWorkflowArtifactStatus,
  decision: StatusWorkflowRenderDecision,
): StatusWorkflowStep {
  if (finalReview.kind === "present") {
    return {
      detail: finalReview.message ?? "Local final review handoff is ready.",
      label: "Final review handoff",
      status: finalReviewWorkflowStatus(finalReview),
    };
  }
  if (finalReview.kind === "invalid" || finalReview.kind === "stale") {
    return { detail: finalReview.message, label: "Final review handoff", status: "blocked" };
  }
  return {
    detail: "Create the local final review handoff after recording the operator decision.",
    label: "Final review handoff",
    status: decision.kind === "present" ? "current" : "pending",
  };
}

function channelHandoffStep(
  channelHandoff: StatusWorkflowArtifactStatus,
  finalReview: StatusWorkflowArtifactStatus,
): StatusWorkflowStep {
  if (channelHandoff.kind === "present") {
    return {
      detail: channelHandoff.message ?? "Manual channel handoff package is ready.",
      label: "Manual channel handoff",
      status: "done",
    };
  }
  if (channelHandoff.kind === "invalid" || channelHandoff.kind === "stale") {
    return { detail: channelHandoff.message, label: "Manual channel handoff", status: "blocked" };
  }
  return {
    detail: "Prepare the manual channel package after accepted local final review.",
    label: "Manual channel handoff",
    status: isAcceptedFinalReview(finalReview) ? "current" : "pending",
  };
}

function isAcceptedFinalReview(finalReview: StatusWorkflowArtifactStatus): boolean {
  return finalReview.kind === "present" && finalReview.status === "accepted-for-local-review";
}

function finalReviewWorkflowStatus(
  finalReview: Extract<StatusWorkflowArtifactStatus, { kind: "present" }>,
): StatusWorkflowStep["status"] {
  if (isAcceptedFinalReview(finalReview)) return "done";
  return finalReview.status === "decision-pending" ? "current" : "blocked";
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
