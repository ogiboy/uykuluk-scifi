import type { RunState } from "../core/state.js";
import type { ProductionMediaStatus } from "./statusMediaSummary.js";

const workflowStates: RunState[] = [
  "NEW",
  "IDEAS_GENERATED",
  "IDEA_APPROVED",
  "SCRIPT_GENERATED",
  "SCRIPT_REVIEWED",
  "SCRIPT_APPROVED",
  "PRODUCTION_PACKAGE_GENERATED",
  "COST_ESTIMATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
  "RENDER_APPROVED",
  "RENDERED",
  "UPLOAD_APPROVED",
  "UPLOADED_PRIVATE",
  "PUBLISH_APPROVED",
  "SCHEDULED_OR_PUBLIC",
  "ARCHIVED",
  "FAILED",
];

export type StatusWorkflowStepStatus = "blocked" | "current" | "done" | "pending";

export type StatusWorkflowRenderDecision =
  | { kind: "invalid" | "stale"; message: string }
  | { kind: "missing" | "present"; message?: string };

export type StatusWorkflowInput = {
  mediaArtifacts: readonly ProductionMediaStatus[];
  readinessStatus: "blocked" | "invalid" | "missing" | "passed" | "stale";
  renderDecision: StatusWorkflowRenderDecision;
  state: RunState;
};

export type StatusWorkflowStep = {
  detail: string;
  label: string;
  status: StatusWorkflowStepStatus;
};

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
  return [
    stateStep(input.state, "Ideas", "IDEAS_GENERATED", "NEW", "Generate ideas."),
    stateStep(
      input.state,
      "Idea approval",
      "IDEA_APPROVED",
      "IDEAS_GENERATED",
      "Approve one idea.",
    ),
    stateStep(
      input.state,
      "Script draft",
      "SCRIPT_GENERATED",
      "IDEA_APPROVED",
      "Generate the script.",
    ),
    stateStep(
      input.state,
      "Script review",
      "SCRIPT_REVIEWED",
      "SCRIPT_GENERATED",
      "Review script blockers and warnings.",
    ),
    stateStep(
      input.state,
      "Script approval",
      "SCRIPT_APPROVED",
      "SCRIPT_REVIEWED",
      "Approve the reviewed script digest.",
    ),
    stateStep(
      input.state,
      "Production package",
      "PRODUCTION_PACKAGE_GENERATED",
      "SCRIPT_APPROVED",
      "Generate the production package.",
    ),
    mediaStep(
      "Render plan",
      media.renderPlan,
      stateAtLeast(input.state, "PRODUCTION_PACKAGE_GENERATED"),
      "Generate and review the contact sheet.",
    ),
    readinessStep(input),
    mediaStep(
      "Voiceover",
      media.voiceoverAudio,
      input.readinessStatus === "passed",
      "Generate and review local audio.",
    ),
    renderApprovalStep(input.state, media.voiceoverAudio),
    mediaStep(
      "Draft render",
      media.draftRender,
      stateAtLeast(input.state, "RENDER_APPROVED"),
      "Render the local MP4 draft.",
    ),
    renderDecisionStep(input.renderDecision, input.state),
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

function mediaByKey(mediaArtifacts: readonly ProductionMediaStatus[]): {
  draftRender?: ProductionMediaStatus;
  renderPlan?: ProductionMediaStatus;
  voiceoverAudio?: ProductionMediaStatus;
} {
  return Object.fromEntries(mediaArtifacts.map((artifact) => [artifact.evidenceKey, artifact]));
}

function stateAtLeast(currentState: RunState, targetState: RunState): boolean {
  return workflowStates.indexOf(currentState) >= workflowStates.indexOf(targetState);
}
