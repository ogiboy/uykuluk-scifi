export type RunState =
  | "NEW"
  | "IDEAS_GENERATED"
  | "IDEA_APPROVED"
  | "SCRIPT_GENERATED"
  | "SCRIPT_REVIEWED"
  | "SCRIPT_APPROVED"
  | "PRODUCTION_PACKAGE_GENERATED"
  | "COST_ESTIMATED"
  | "READY_FOR_MANUAL_PRODUCTION"
  | "RENDER_APPROVED"
  | "RENDERED"
  | "UPLOAD_APPROVED"
  | "UPLOADED_PRIVATE"
  | "PUBLISH_APPROVED"
  | "SCHEDULED_OR_PUBLIC"
  | "ARCHIVED"
  | "FAILED";

export type ApprovalTarget = "idea" | "script" | "render" | "upload" | "publish";

export type ApprovalRecord = {
  approvalId: string;
  runId: string;
  target: ApprovalTarget;
  approvedRef?: string;
  previousState: RunState;
  nextState: RunState;
  approvingCommand: string;
  createdAt: string;
};

export type RunRecord = {
  runId: string;
  state: RunState;
  createdAt: string;
  updatedAt: string;
  approvedIdeaId?: string;
  approvals: ApprovalRecord[];
  artifacts: string[];
  warnings: string[];
};

export type LedgerEventType =
  | "RUN_CREATED"
  | "STATE_CHANGED"
  | "ARTIFACT_WRITTEN"
  | "APPROVAL_RECORDED"
  | "COST_ESTIMATED"
  | "GUARD_PASSED"
  | "GUARD_BLOCKED"
  | "WARNING"
  | "ERROR";

export type LedgerEvent = {
  eventId: string;
  runId: string;
  type: LedgerEventType;
  stage: string;
  message: string;
  data?: unknown;
  createdAt: string;
};

export type CostEvent = {
  runId: string;
  stage: string;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd: number;
  actualUsd?: number;
  durationMs?: number;
  createdAt: string;
};

export const orderedStates: RunState[] = [
  "NEW",
  "IDEAS_GENERATED",
  "IDEA_APPROVED",
  "SCRIPT_GENERATED",
  "SCRIPT_REVIEWED",
  "SCRIPT_APPROVED",
  "PRODUCTION_PACKAGE_GENERATED",
  "COST_ESTIMATED",
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
