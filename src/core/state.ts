import { z } from "zod";

const runStates = [
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
] as const;

const approvalTargets = [
  "idea",
  "script",
  "paid-generation-cost",
  "render",
  "upload",
  "publish",
] as const;

export const runStateSchema = z.enum(runStates);
export const approvalTargetSchema = z.enum(approvalTargets);

export type RunState = z.infer<typeof runStateSchema>;
export type ApprovalTarget = z.infer<typeof approvalTargetSchema>;

export const approvalRecordSchema = z.strictObject({
  approvalId: z.string().min(1),
  runId: z.string().min(1),
  target: approvalTargetSchema,
  approvedRef: z.string().min(1).optional(),
  previousState: runStateSchema,
  nextState: runStateSchema,
  approvingCommand: z.string().min(1),
  acknowledgedWarnings: z.array(z.string().min(1)).optional(),
  createdAt: z.iso.datetime(),
});

export const runRecordSchema = z.strictObject({
  runId: z.string().min(1),
  state: runStateSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  approvedIdeaId: z.string().min(1).optional(),
  approvals: z.array(approvalRecordSchema),
  artifacts: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;

export type LedgerEventType =
  | "RUN_CREATED"
  | "STATE_CHANGED"
  | "ARTIFACT_WRITTEN"
  | "ARTIFACT_REMOVED"
  | "ARTIFACT_REVISED"
  | "ARTIFACT_ROLLBACK"
  | "REVIEW_DECISION_RECORDED"
  | "APPROVAL_RECORDED"
  | "COST_ESTIMATED"
  | "COST_RESERVED"
  | "COST_EXECUTION_STARTED"
  | "COST_RELEASED"
  | "COST_UNCERTAIN"
  | "COST_SETTLED"
  | "COST_RECONCILED"
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
  reservationId?: string;
  resultEvidenceDigest?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd: number;
  actualUsd?: number;
  durationMs?: number;
  createdAt: string;
};

export const costEventSchema = z.strictObject({
  runId: z.string().min(1),
  stage: z.string().min(1),
  provider: z.string().min(1),
  reservationId: z.string().min(1).optional(),
  resultEvidenceDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  model: z.string().min(1).optional(),
  inputTokens: z.int().nonnegative().optional(),
  outputTokens: z.int().nonnegative().optional(),
  estimatedUsd: z.number().nonnegative(),
  actualUsd: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  createdAt: z.iso.datetime(),
});

export const orderedStates: RunState[] = [...runStates];
