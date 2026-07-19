import { z } from "zod";
import { SafeExitError } from "../core/errors.js";

export const localModelCatalog = {
  "mflux-flux2-klein-4b-q4": {
    id: "mflux-flux2-klein-4b-q4",
    runtime: "mflux",
    runtimeVersion: "0.18.0",
    pythonRequires: ">=3.12,<3.13",
    modelRepository: "mlx-community/flux2-klein-4b-4bit",
    modelRevision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
    quantization: "q4",
  },
} as const;

export type LocalModelId = keyof typeof localModelCatalog;
export type LocalModelIntentKind = "setup" | "verify" | "smoke";
export type LocalModelOperationStatus =
  "queued" | "running" | "succeeded" | "failed" | "interrupted";
export type LocalModelProgressPhase =
  | "queued"
  | "setting-up"
  | "downloading-model"
  | "verifying"
  | "completed"
  | "failed"
  | "interrupted";
export type LocalModelReadiness =
  "absent" | "setup-pending" | "setup-running" | "ready" | "failed" | "interrupted";

export type LocalModelIntent = Readonly<{ modelId: LocalModelId; kind: LocalModelIntentKind }>;

export type LocalModelProgress = Readonly<{
  phase: LocalModelProgressPhase;
  completedBytes?: number;
  totalBytes?: number;
}>;

export type LocalModelOperation = Readonly<{
  operationId: string;
  runId?: string;
  modelId: LocalModelId;
  kind: LocalModelIntentKind;
  status: LocalModelOperationStatus;
  progress: LocalModelProgress;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  workerId?: string;
  message?: string;
}>;

export type LocalModelOperationPreparation = Readonly<{
  schemaVersion: 1;
  runId: string;
  bindingDigest: string;
  estimatedUsdMicros: 0;
  estimatedDurationSeconds: number;
  estimatedDiskBytes: number;
  packageId: LocalModelId;
  operation: LocalModelIntentKind;
  preparedAt: string;
}>;

export type LocalModelOverview = Readonly<{
  catalog: readonly (typeof localModelCatalog)[LocalModelId][];
  readiness: LocalModelReadiness;
  recoveryAvailable: boolean;
  latestOperation?: LocalModelOperation;
  progress?: LocalModelProgress;
  preparation?: LocalModelOperationPreparation;
  runtimePath: string;
  nextAction: string;
}>;

export const localModelOperationSchema = z.object({
  operationId: z.string().regex(/^local_model_[a-z0-9_]+$/),
  runId: z
    .string()
    .regex(/^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/)
    .optional(),
  modelId: z.literal("mflux-flux2-klein-4b-q4"),
  kind: z.enum(["setup", "verify", "smoke"]),
  status: z.enum(["queued", "running", "succeeded", "failed", "interrupted"]),
  progress: z.object({
    phase: z.enum([
      "queued",
      "setting-up",
      "downloading-model",
      "verifying",
      "completed",
      "failed",
      "interrupted",
    ]),
    completedBytes: z.int().nonnegative().optional(),
    totalBytes: z.int().positive().optional(),
  }),
  requestedAt: z.string().min(1),
  startedAt: z.string().min(1).optional(),
  finishedAt: z.string().min(1).optional(),
  workerId: z.string().min(1).max(160).optional(),
  message: z.string().min(1).max(1_000).optional(),
});

export const localModelOperationsSchema = z.object({
  schemaVersion: z.literal(1),
  operations: z.array(localModelOperationSchema),
});

export const localModelReadySchema = z.object({
  schemaVersion: z.literal(1),
  modelId: z.literal("mflux-flux2-klein-4b-q4"),
  runtimeVersion: z.literal("0.18.0"),
  modelRepository: z.literal("mlx-community/flux2-klein-4b-4bit"),
  modelRevision: z.literal("860e87183ceb29e39627c0612ebd66d8ea66e68c"),
  quantization: z.literal("q4"),
  verifiedAt: z.string().min(1),
});

export const localModelPreparationSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/),
  bindingDigest: z.string().regex(/^[a-f0-9]{64}$/),
  estimatedUsdMicros: z.literal(0),
  estimatedDurationSeconds: z.int().positive(),
  estimatedDiskBytes: z.int().positive(),
  packageId: z.literal("mflux-flux2-klein-4b-q4"),
  operation: z.enum(["setup", "verify", "smoke"]),
  preparedAt: z.string().min(1),
});

export const localModelPreparationPointerSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().regex(/^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/),
});

export function validateLocalModelIntent(intent: LocalModelIntent): void {
  if (!(intent.modelId in localModelCatalog)) {
    throw new SafeExitError(
      "Unknown local model package; only the curated MFLUX catalog is allowed.",
    );
  }
  if (intent.kind !== "setup" && intent.kind !== "verify" && intent.kind !== "smoke") {
    throw new SafeExitError("Unknown local model intent.");
  }
}

export function validateLocalModelApproval(input: {
  runId: string;
  bindingDigest: string;
  approvedBy: string;
  confirmExecution: true;
}): void {
  if (!/^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/.test(input.runId)) {
    throw new SafeExitError("Local model preparation run id is invalid.");
  }
  if (!/^[a-f0-9]{64}$/.test(input.bindingDigest)) {
    throw new SafeExitError("Local model preparation binding digest is invalid.");
  }
  if (input.confirmExecution !== true) {
    throw new SafeExitError("Local model execution requires explicit operator confirmation.");
  }
  validateLocalModelText(
    input.approvedBy,
    160,
    "Local model execution approver is missing or unsafe.",
  );
}

export function validateLocalModelOperationId(operationId: string): void {
  if (!/^local_model_[a-z0-9_]+$/.test(operationId)) {
    throw new SafeExitError("Local model operation id is invalid.");
  }
}

export function validateLocalModelText(value: string, maximum: number, message: string): void {
  const safe = [...value].every(
    (character) => (character.codePointAt(0) ?? 0) >= 32 || "\n\r\t".includes(character),
  );
  if (value.trim().length === 0 || value.length > maximum || !safe) {
    throw new SafeExitError(message);
  }
}

export function validateLocalModelProgress(progress: LocalModelProgress): void {
  if (!["setting-up", "downloading-model", "verifying"].includes(progress.phase)) {
    throw new SafeExitError("Local model worker progress phase is invalid.");
  }
  if (progress.totalBytes !== undefined && progress.completedBytes === undefined) {
    throw new SafeExitError(
      "Local model worker progress cannot include a total without measured bytes.",
    );
  }
  const completedBytes = progress.completedBytes;
  const totalBytes = progress.totalBytes;
  if (
    completedBytes !== undefined &&
    totalBytes !== undefined &&
    (!Number.isSafeInteger(completedBytes) ||
      !Number.isSafeInteger(totalBytes) ||
      completedBytes < 0 ||
      totalBytes <= 0 ||
      completedBytes > totalBytes)
  ) {
    throw new SafeExitError("Local model worker progress bytes are invalid.");
  }
}

export function replaceLocalModelOperation(
  operations: readonly LocalModelOperation[],
  index: number,
  operation: LocalModelOperation,
): LocalModelOperation[] {
  return [...operations.slice(0, index), operation, ...operations.slice(index + 1)];
}

export function claimedLocalModelPhase(kind: LocalModelIntent["kind"]): LocalModelProgressPhase {
  return kind === "setup" ? "setting-up" : "verifying";
}

export function determineLocalModelReadiness(
  operation: LocalModelOperation | undefined,
  ready: boolean,
): LocalModelReadiness {
  if (operation?.status === "queued") return "setup-pending";
  if (operation?.status === "running") return "setup-running";
  if (ready) return "ready";
  if (operation?.status === "interrupted") return "interrupted";
  if (operation?.status === "failed") return "failed";
  return "absent";
}

export function nextActionForLocalModelReadiness(readiness: LocalModelReadiness): string {
  return {
    ready: "Local FLUX is ready for a Studio visual generation request.",
    "setup-pending": "A trusted local worker must claim the queued setup intent.",
    "setup-running":
      "Wait for the current local model worker to finish before submitting another intent.",
    failed: "Review the local worker diagnostic, then submit a new setup intent.",
    interrupted:
      "Review the interrupted operation, then submit a new setup or verification intent.",
    absent:
      "Install the optional local MFLUX runtime from Studio to enable local image generation.",
  }[readiness];
}

export function estimatedLocalModelDuration(operation: LocalModelIntent["kind"]): number {
  if (operation === "setup") return 600;
  if (operation === "verify") return 30;
  return 180;
}

export function estimatedLocalModelDiskBytes(operation: LocalModelIntent["kind"]): number {
  if (operation === "setup") return 6_500_000_000;
  if (operation === "verify") return 1_024;
  return 8_388_608;
}

export function localModelOperationIsActive(operation: LocalModelOperation): boolean {
  return operation.status === "queued" || operation.status === "running";
}

export function localModelOperationIsRecoverable(operation: LocalModelOperation): boolean {
  if (operation.status === "running") return !isRecordedLocalModelWorkerAlive(operation.workerId);
  if (operation.status !== "queued") return false;
  const requestedAt = Date.parse(operation.requestedAt);
  return !Number.isFinite(requestedAt) || Date.now() - requestedAt >= 30_000;
}

function isRecordedLocalModelWorkerAlive(workerId: string | undefined): boolean {
  const match = /^studio-(\d+)$/.exec(workerId ?? "");
  if (!match) return false;
  const pid = Number(match[1]);
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
