import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { SafeExitError } from "../core/errors.js";
import { projectRunPath } from "../core/runPaths.js";
import { canonicalJsonDigest } from "../utils/canonicalJsonDigest.js";
import { pathExists, writeFileAtomic } from "../utils/fs.js";
import { nowIso } from "../utils/time.js";
import {
  localModelCatalog,
  localModelOperationsSchema,
  localModelPreparationPointerSchema,
  localModelPreparationSchema,
  localModelReadySchema,
  type LocalModelOperation,
  type LocalModelOperationPreparation,
} from "./localModelContracts.js";

const lockSettings = { timeoutMs: 5_000, retryMs: 20 };

export type LocalModelStatePaths = Readonly<{
  runtimePath: string;
  installManifestPath: string;
  operationsPath: string;
  readyPath: string;
  preparationPointerPath: string;
  lockPath: string;
}>;

export function localModelStatePaths(projectRoot: string): LocalModelStatePaths {
  const runtimePath = path.join(path.resolve(projectRoot), ".local-models", "mflux");
  return {
    runtimePath,
    installManifestPath: path.join(runtimePath, "install-manifest.json"),
    operationsPath: path.join(runtimePath, "operations.json"),
    readyPath: path.join(runtimePath, "ready.json"),
    preparationPointerPath: path.join(runtimePath, "latest-preparation.json"),
    lockPath: path.join(path.dirname(runtimePath), ".mutation.lock"),
  };
}

export async function withLocalModelLock<T>(
  paths: LocalModelStatePaths,
  task: () => Promise<T>,
): Promise<T> {
  await mkdir(path.dirname(paths.lockPath), { recursive: true });
  await acquireLock(paths.lockPath);
  try {
    return await task();
  } finally {
    await rm(paths.lockPath, { recursive: true, force: true });
  }
}

export async function readLocalModelOperations(target: string): Promise<LocalModelOperation[]> {
  if (!(await pathExists(target))) return [];
  try {
    return localModelOperationsSchema.parse(JSON.parse(await readFile(target, "utf8"))).operations;
  } catch (error) {
    throwInvalidJson(error, "Local model operation records are invalid.");
  }
}

export async function writeLocalModelOperations(
  target: string,
  operations: readonly LocalModelOperation[],
): Promise<void> {
  await writeFileAtomic(target, `${JSON.stringify({ schemaVersion: 1, operations }, null, 2)}\n`);
}

export async function readLocalModelReady(target: string): Promise<boolean> {
  if (!(await pathExists(target))) return false;
  try {
    localModelReadySchema.parse(JSON.parse(await readFile(target, "utf8")));
    return true;
  } catch (error) {
    throwInvalidJson(error, "Local MFLUX readiness marker is invalid.");
  }
}

export async function writeLocalModelReady(target: string): Promise<void> {
  const model = localModelCatalog["mflux-flux2-klein-4b-q4"];
  await writeFileAtomic(
    target,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        modelId: model.id,
        runtimeVersion: model.runtimeVersion,
        modelRepository: model.modelRepository,
        modelRevision: model.modelRevision,
        quantization: model.quantization,
        verifiedAt: nowIso(),
      },
      null,
    )}\n`,
  );
}

export async function clearLocalModelReady(target: string): Promise<void> {
  await rm(target, { force: true });
}

export async function writeLocalModelPreparation(
  projectRoot: string,
  preparation: LocalModelOperationPreparation,
): Promise<void> {
  await writeFileAtomic(
    preparationPath(projectRoot, preparation.runId),
    `${JSON.stringify(preparation, null, 2)}\n`,
  );
  await writeFileAtomic(
    localModelStatePaths(projectRoot).preparationPointerPath,
    `${JSON.stringify({ schemaVersion: 1, runId: preparation.runId }, null, 2)}\n`,
  );
}

export async function readLocalModelPreparation(
  projectRoot: string,
  runId: string,
): Promise<LocalModelOperationPreparation> {
  const target = preparationPath(projectRoot, runId);
  if (!(await pathExists(target)))
    throw new SafeExitError("Local model operation preparation was not found.");
  try {
    const preparation = localModelPreparationSchema.parse(
      JSON.parse(await readFile(target, "utf8")),
    );
    const { bindingDigest, ...unbound } = preparation;
    if (bindingDigest !== localModelPreparationDigest(unbound)) {
      throw new SafeExitError(
        "Local model operation preparation digest does not match its contents.",
      );
    }
    return preparation;
  } catch (error) {
    if (error instanceof SafeExitError) throw error;
    throwInvalidJson(error, "Local model operation preparation is invalid.");
  }
}

export async function readLatestLocalModelPreparation(
  projectRoot: string,
  pointerPath: string,
): Promise<LocalModelOperationPreparation | undefined> {
  if (!(await pathExists(pointerPath))) return undefined;
  try {
    const pointer = localModelPreparationPointerSchema.parse(
      JSON.parse(await readFile(pointerPath, "utf8")),
    );
    return readLocalModelPreparation(projectRoot, pointer.runId);
  } catch (error) {
    if (error instanceof SafeExitError) throw error;
    throwInvalidJson(error, "Local model preparation pointer is invalid.");
  }
}

export async function clearLocalModelPreparationIfMatches(
  pointerPath: string,
  runId: string,
): Promise<void> {
  if (!(await pathExists(pointerPath))) return;
  try {
    const pointer = localModelPreparationPointerSchema.parse(
      JSON.parse(await readFile(pointerPath, "utf8")),
    );
    if (pointer.runId === runId) await rm(pointerPath, { force: true });
  } catch (error) {
    throwInvalidJson(error, "Local model preparation pointer is invalid.");
  }
}

export function localModelPreparationDigest(
  preparation: Omit<LocalModelOperationPreparation, "bindingDigest">,
): string {
  return canonicalJsonDigest(preparation, {
    nonFiniteNumber: "Local model preparation contains a non-finite number.",
    unsupportedValue: "Local model preparation contains an unsupported value.",
  });
}

export async function writeLocalModelExecutionEvidence(
  projectRoot: string,
  runId: string,
  evidence: Readonly<{
    schemaVersion: 1;
    bindingDigest: string;
    approvedBy: string;
    operationId: string;
    executedAt: string;
  }>,
): Promise<void> {
  await writeFileAtomic(
    projectRunPath(projectRoot, runId, "diagnostics", "local-models", "execution.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}

export async function writeLocalModelWorkerEvidence(
  projectRoot: string,
  runId: string,
  evidence: Readonly<{
    schemaVersion: 1;
    operationId: string;
    kind: string;
    model: Readonly<{
      id: string;
      repository: string;
      revision: string;
      runtimeVersion: string;
      quantization: string;
    }>;
    startedAt: string;
    finishedAt: string;
    status: "succeeded" | "failed";
    diagnostic: string;
    installManifestDigest?: string;
    smoke?: Readonly<{
      path: "diagnostics/local-models/smoke.png";
      digest: string;
      bytes: number;
      durationMs: number;
    }>;
  }>,
): Promise<void> {
  await writeFileAtomic(
    projectRunPath(projectRoot, runId, "diagnostics", "local-models", "worker.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}

export async function writeLocalModelRecoveryEvidence(
  projectRoot: string,
  runId: string,
  evidence: Readonly<{
    schemaVersion: 1;
    operationId: string;
    previousStatus: "queued" | "running";
    recoveredAt: string;
    reason: "worker-not-running";
  }>,
): Promise<void> {
  await writeFileAtomic(
    projectRunPath(projectRoot, runId, "diagnostics", "local-models", "recovery.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}

function preparationPath(projectRoot: string, runId: string): string {
  return projectRunPath(projectRoot, runId, "diagnostics", "local-models", "preparation.json");
}

async function acquireLock(target: string): Promise<void> {
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(target);
      await writeFile(path.join(target, "owner"), `${process.pid}\n`, "utf8");
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() - startedAt >= lockSettings.timeoutMs) {
        throw new SafeExitError("Timed out waiting for the local model operation lock.");
      }
      await new Promise((resolve) => setTimeout(resolve, lockSettings.retryMs));
    }
  }
}

function throwInvalidJson(error: unknown, message: string): never {
  if (error instanceof z.ZodError || error instanceof SyntaxError) throw new SafeExitError(message);
  throw error;
}
