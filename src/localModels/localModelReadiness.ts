import { SafeExitError } from "../core/errors.js";
import { pathExists } from "../utils/fs.js";
import { createId, nowIso } from "../utils/time.js";
import {
  claimedLocalModelPhase,
  determineLocalModelReadiness,
  estimatedLocalModelDiskBytes,
  estimatedLocalModelDuration,
  localModelCatalog,
  localModelOperationIsActive,
  localModelOperationIsRecoverable,
  nextActionForLocalModelReadiness,
  replaceLocalModelOperation,
  validateLocalModelApproval,
  validateLocalModelIntent,
  validateLocalModelOperationId,
  validateLocalModelProgress,
  validateLocalModelText,
  type LocalModelId,
  type LocalModelIntent,
  type LocalModelOperation,
  type LocalModelOperationPreparation,
  type LocalModelOverview,
  type LocalModelProgress,
} from "./localModelContracts.js";
import {
  clearLocalModelPreparationIfMatches,
  clearLocalModelReady,
  localModelPreparationDigest,
  localModelStatePaths,
  readLatestLocalModelPreparation,
  readLocalModelOperations,
  readLocalModelPreparation,
  readLocalModelReady,
  withLocalModelLock,
  writeLocalModelExecutionEvidence,
  writeLocalModelOperations,
  writeLocalModelPreparation,
  writeLocalModelReady,
  writeLocalModelRecoveryEvidence,
  type LocalModelStatePaths,
} from "./localModelStore.js";

export * from "./localModelContracts.js";
export { localModelStatePaths, type LocalModelStatePaths } from "./localModelStore.js";

/** Reads the filesystem-only, operator-safe local MFLUX readiness overview. */
export async function readOverview(projectRoot: string): Promise<LocalModelOverview> {
  const paths = localModelStatePaths(projectRoot);
  const [operations, readyMarker, installManifest, preparation] = await Promise.all([
    readLocalModelOperations(paths.operationsPath),
    readLocalModelReady(paths.readyPath),
    pathExists(paths.installManifestPath),
    readLatestLocalModelPreparation(projectRoot, paths.preparationPointerPath),
  ]);
  const latestOperation = operations.at(-1);
  const readiness = determineLocalModelReadiness(latestOperation, readyMarker && installManifest);
  return {
    catalog: Object.values(localModelCatalog),
    readiness,
    recoveryAvailable: operations.some(localModelOperationIsRecoverable),
    latestOperation,
    progress: latestOperation?.progress,
    preparation,
    runtimePath: paths.runtimePath,
    nextAction: nextActionForLocalModelReadiness(readiness),
  };
}

/** Queues a closed, rehydratable local-model intent without starting a heavy process. */
export async function submitIntent(
  projectRoot: string,
  intent: LocalModelIntent,
): Promise<LocalModelOperation> {
  validateLocalModelIntent(intent);
  const paths = localModelStatePaths(projectRoot);
  return withLocalModelLock(paths, async () => queueIntent(paths, intent));
}

/** Persists a reviewed local-model preparation before setup, verify, or smoke execution. */
export async function prepareLocalModelOperation(
  projectRoot: string,
  input: Readonly<{ packageId: LocalModelId; operation: LocalModelIntent["kind"] }>,
): Promise<LocalModelOperationPreparation> {
  validateLocalModelIntent({ modelId: input.packageId, kind: input.operation });
  const paths = localModelStatePaths(projectRoot);
  return withLocalModelLock(paths, async () => {
    await recoverInterruptedIntentsWithinLock(projectRoot, paths);
    const operations = await readLocalModelOperations(paths.operationsPath);
    if (operations.some(localModelOperationIsActive)) {
      throw new SafeExitError(
        "A local model setup or verification operation is already in progress.",
      );
    }
    const runId = createId("run");
    const payload = {
      schemaVersion: 1 as const,
      runId,
      estimatedUsdMicros: 0 as const,
      estimatedDurationSeconds: estimatedLocalModelDuration(input.operation),
      estimatedDiskBytes: estimatedLocalModelDiskBytes(input.operation),
      packageId: input.packageId,
      operation: input.operation,
      preparedAt: nowIso(),
    };
    const preparation: LocalModelOperationPreparation = {
      ...payload,
      bindingDigest: localModelPreparationDigest(payload),
    };
    await writeLocalModelPreparation(projectRoot, preparation);
    return preparation;
  });
}

/** Revalidates exact preparation evidence before queueing a confirmed local operation. */
export async function executeApprovedLocalModelOperation(
  projectRoot: string,
  input: Readonly<{
    runId: string;
    bindingDigest: string;
    approvedBy: string;
    confirmExecution: true;
  }>,
): Promise<LocalModelOperation> {
  validateLocalModelApproval(input);
  const paths = localModelStatePaths(projectRoot);
  return withLocalModelLock(paths, async () => {
    const latest = await readLatestLocalModelPreparation(projectRoot, paths.preparationPointerPath);
    if (latest?.runId !== input.runId) {
      throw new SafeExitError(
        "Local model operation approval is stale; review the current preparation.",
      );
    }
    const preparation = await readLocalModelPreparation(projectRoot, input.runId);
    if (preparation.bindingDigest !== input.bindingDigest) {
      throw new SafeExitError(
        "Local model operation approval is stale; review the current preparation.",
      );
    }
    const operation = await queueIntent(
      paths,
      { modelId: preparation.packageId, kind: preparation.operation },
      preparation.runId,
    );
    await writeLocalModelExecutionEvidence(projectRoot, preparation.runId, {
      schemaVersion: 1,
      bindingDigest: preparation.bindingDigest,
      approvedBy: input.approvedBy.trim(),
      operationId: operation.operationId,
      executedAt: nowIso(),
    });
    await clearLocalModelPreparationIfMatches(paths.preparationPointerPath, preparation.runId);
    return operation;
  });
}

/** Claims exactly one queued operation after a Studio restart or trusted worker reconnect. */
export async function claimNextIntent(
  projectRoot: string,
  workerId: string,
): Promise<LocalModelOperation | undefined> {
  validateLocalModelText(workerId, 160, "Local model worker id is missing or unsafe.");
  const paths = localModelStatePaths(projectRoot);
  return withLocalModelLock(paths, async () => {
    const operations = await readLocalModelOperations(paths.operationsPath);
    if (operations.some((operation) => operation.status === "running")) {
      throw new SafeExitError("A local model operation is already running.");
    }
    const index = operations.findIndex((operation) => operation.status === "queued");
    if (index < 0) return undefined;
    const operation: LocalModelOperation = {
      ...operations[index],
      status: "running",
      progress: { phase: claimedLocalModelPhase(operations[index].kind) },
      workerId: workerId.trim(),
      startedAt: nowIso(),
    };
    await writeLocalModelOperations(
      paths.operationsPath,
      replaceLocalModelOperation(operations, index, operation),
    );
    return operation;
  });
}

/** Persists truthful worker progress; byte counters are never inferred as a percentage. */
export async function updateIntentProgress(
  projectRoot: string,
  input: Readonly<{ operationId: string; progress: LocalModelProgress }>,
): Promise<LocalModelOperation> {
  validateLocalModelOperationId(input.operationId);
  validateLocalModelProgress(input.progress);
  return updateRunningOperation(projectRoot, input.operationId, (operation) => ({
    ...operation,
    progress: input.progress,
  }));
}

/** Completes a running operation and writes the fixed readiness marker after setup succeeds. */
export async function completeIntent(
  projectRoot: string,
  input: Readonly<{ operationId: string; status: "succeeded" | "failed"; message?: string }>,
): Promise<LocalModelOperation> {
  validateLocalModelOperationId(input.operationId);
  if (input.message !== undefined)
    validateLocalModelText(input.message, 1_000, "Local model operation message is unsafe.");
  const paths = localModelStatePaths(projectRoot);
  const operation = await updateRunningOperation(projectRoot, input.operationId, (current) => ({
    ...current,
    status: input.status,
    progress: { phase: input.status === "succeeded" ? "completed" : "failed" },
    finishedAt: nowIso(),
    ...(input.message ? { message: input.message.trim() } : {}),
  }));
  if (
    operation.status === "succeeded" &&
    (operation.kind === "setup" || operation.kind === "verify")
  ) {
    await writeLocalModelReady(paths.readyPath);
  }
  if (
    operation.status === "failed" &&
    (operation.kind === "setup" || operation.kind === "verify")
  ) {
    await clearLocalModelReady(paths.readyPath);
  }
  return operation;
}

/** Converts stale worker records or one known launch failure into explicit interruption evidence. */
export async function recoverInterruptedIntents(
  projectRoot: string,
  queuedOperationId?: string,
): Promise<number> {
  if (queuedOperationId) validateLocalModelOperationId(queuedOperationId);
  const paths = localModelStatePaths(projectRoot);
  return withLocalModelLock(paths, () =>
    recoverInterruptedIntentsWithinLock(projectRoot, paths, queuedOperationId),
  );
}

async function recoverInterruptedIntentsWithinLock(
  projectRoot: string,
  paths: LocalModelStatePaths,
  queuedOperationId?: string,
): Promise<number> {
  const operations = await readLocalModelOperations(paths.operationsPath);
  const recoveredAt = nowIso();
  const recoverable = operations.filter((operation) =>
    queuedOperationId
      ? operation.operationId === queuedOperationId && operation.status === "queued"
      : localModelOperationIsRecoverable(operation),
  );
  const reason = queuedOperationId ? "worker-start-failed" : "worker-not-running";
  const recoveryMessage = queuedOperationId
    ? "The local model worker could not start; review and submit a new intent."
    : "The previous local model worker did not complete; review and submit a new intent.";
  await Promise.all(
    recoverable.map((operation) =>
      operation.runId
        ? writeLocalModelRecoveryEvidence(projectRoot, operation.runId, {
            schemaVersion: 1,
            operationId: operation.operationId,
            previousStatus: operation.status as "queued" | "running",
            recoveredAt,
            reason,
          })
        : Promise.resolve(),
    ),
  );
  if (recoverable.length === 0) return 0;
  const recoveredIds = new Set(recoverable.map((operation) => operation.operationId));
  await writeLocalModelOperations(
    paths.operationsPath,
    operations.map((operation) =>
      recoveredIds.has(operation.operationId)
        ? {
            ...operation,
            status: "interrupted" as const,
            progress: { phase: "interrupted" as const },
            finishedAt: recoveredAt,
            message: recoveryMessage,
          }
        : operation,
    ),
  );
  return recoverable.length;
}

async function updateRunningOperation(
  projectRoot: string,
  operationId: string,
  update: (operation: LocalModelOperation) => LocalModelOperation,
): Promise<LocalModelOperation> {
  const paths = localModelStatePaths(projectRoot);
  return withLocalModelLock(paths, async () => {
    const operations = await readLocalModelOperations(paths.operationsPath);
    const index = operations.findIndex((operation) => operation.operationId === operationId);
    if (index < 0) throw new SafeExitError("Local model operation was not found.");
    if (operations[index].status !== "running") {
      throw new SafeExitError("Only a running local model operation can be updated.");
    }
    const operation = update(operations[index]);
    await writeLocalModelOperations(
      paths.operationsPath,
      replaceLocalModelOperation(operations, index, operation),
    );
    return operation;
  });
}

function queueIntent(
  paths: LocalModelStatePaths,
  intent: LocalModelIntent,
  runId?: string,
): Promise<LocalModelOperation> {
  return readLocalModelOperations(paths.operationsPath).then(async (operations) => {
    if (
      operations.some(
        (operation) => operation.status === "queued" || operation.status === "running",
      )
    ) {
      throw new SafeExitError(
        "A local model setup or verification operation is already in progress.",
      );
    }
    const operation: LocalModelOperation = {
      operationId: createId("local_model"),
      ...(runId ? { runId } : {}),
      modelId: intent.modelId,
      kind: intent.kind,
      status: "queued",
      progress: { phase: "queued" },
      requestedAt: nowIso(),
    };
    await writeLocalModelOperations(paths.operationsPath, [...operations, operation]);
    return operation;
  });
}
