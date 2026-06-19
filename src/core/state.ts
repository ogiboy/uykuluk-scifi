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

export const approvalRecordSchema = z
  .object({
    approvalId: z.string().min(1),
    runId: z.string().min(1),
    target: approvalTargetSchema,
    approvedRef: z.string().min(1).optional(),
    previousState: runStateSchema,
    nextState: runStateSchema,
    approvingCommand: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();

export const runRecordSchema = z
  .object({
    runId: z.string().min(1),
    state: runStateSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    approvedIdeaId: z.string().min(1).optional(),
    approvals: z.array(approvalRecordSchema),
    artifacts: z.array(z.string()),
    warnings: z.array(z.string()),
  })
  .strict();

export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;

export type LedgerEventType =
  | "RUN_CREATED"
  | "STATE_CHANGED"
  | "ARTIFACT_WRITTEN"
  | "ARTIFACT_REVISED"
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

export const orderedStates: RunState[] = [...runStates];
