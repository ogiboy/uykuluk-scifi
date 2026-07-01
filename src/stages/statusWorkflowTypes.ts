import type { RunState } from "../core/state.js";
import type { ProductionMediaStatus } from "./statusMediaSummary.js";

export type StatusWorkflowStepStatus = "blocked" | "current" | "done" | "pending";

export type StatusWorkflowRenderDecision =
  | { kind: "invalid" | "stale"; message: string }
  | { kind: "missing" | "present"; message?: string };

export type StatusWorkflowArtifactStatus =
  | { kind: "invalid" | "stale"; message: string }
  | { kind: "missing" }
  | { kind: "present"; message?: string; status?: string };

export type StatusWorkflowInput = {
  channelHandoff: StatusWorkflowArtifactStatus;
  finalReviewBundle: StatusWorkflowArtifactStatus;
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
