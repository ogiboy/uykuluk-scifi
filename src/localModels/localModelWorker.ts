import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SafeExitError } from "../core/errors.js";
import { projectRunPath } from "../core/runPaths.js";
import { nowIso } from "../utils/time.js";
import { localModelCatalog } from "./localModelContracts.js";
import {
  claimNextIntent,
  completeIntent,
  readOverview,
  updateIntentProgress,
} from "./localModelReadiness.js";
import { localModelStatePaths, writeLocalModelWorkerEvidence } from "./localModelStore.js";
import { executeMfluxWorker, type MfluxWorkerResult } from "./mfluxProcess.js";

const workerSourcePath = fileURLToPath(import.meta.url);
const workerStartupTimeoutMs = 5_000;
const workerStartupPollMs = 25;

type LocalModelWorkerLaunchDependencies = Readonly<{
  spawnWorker?: (projectRoot: string) => ChildProcess;
  readWorkerOverview?: typeof readOverview;
  startupTimeoutMs?: number;
  pollIntervalMs?: number;
}>;

/**
 * Starts a detached curated MFLUX worker for a project.
 *
 * @param projectRoot - The project root used as the worker's working directory.
 * @param operationId - The queued operation that this worker must claim.
 * @param dependencies - Test-only spawn, overview, and startup timing overrides.
 * @returns The detached worker PID after the exact operation has been claimed.
 * @throws SafeExitError If spawning fails, the child exits or errors before claiming, or the
 * startup timeout expires.
 */
export async function launchLocalModelWorker(
  projectRoot: string,
  operationId: string,
  dependencies: LocalModelWorkerLaunchDependencies = {},
): Promise<Readonly<{ pid: number }>> {
  const child = (dependencies.spawnWorker ?? spawnLocalModelWorker)(projectRoot);
  if (!child.pid) {
    child.once("error", () => undefined);
    throw new SafeExitError("Local model worker could not be started.");
  }
  const pid = child.pid;
  try {
    await waitForWorkerClaim(projectRoot, operationId, child, {
      readWorkerOverview: dependencies.readWorkerOverview ?? readOverview,
      startupTimeoutMs: dependencies.startupTimeoutMs ?? workerStartupTimeoutMs,
      pollIntervalMs: dependencies.pollIntervalMs ?? workerStartupPollMs,
    });
    child.unref();
    return { pid };
  } catch (error) {
    if (child.exitCode === null && !child.killed) child.kill();
    child.unref();
    throw error;
  }
}

function spawnLocalModelWorker(projectRoot: string): ChildProcess {
  const root = path.resolve(projectRoot);
  return spawn(process.execPath, ["--import", "tsx", workerSourcePath, "--project-root", root], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  });
}

async function waitForWorkerClaim(
  projectRoot: string,
  operationId: string,
  child: ChildProcess,
  options: Readonly<{
    readWorkerOverview: typeof readOverview;
    startupTimeoutMs: number;
    pollIntervalMs: number;
  }>,
): Promise<void> {
  const workerId = `studio-${child.pid}`;
  const deadline = Date.now() + options.startupTimeoutMs;
  let exitDiagnostic: string | undefined;
  const onError = (error: Error) => {
    exitDiagnostic = `Local model worker failed before claiming the operation: ${error.message}`;
  };
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    exitDiagnostic = `Local model worker exited during startup (${detail}).`;
  };
  child.on("error", onError);
  child.on("exit", onExit);
  try {
    while (true) {
      const operation = (await options.readWorkerOverview(projectRoot)).latestOperation;
      const expectedOperation = operation?.operationId === operationId;
      const claimedByWorker = expectedOperation && operation.workerId === workerId;
      if (claimedByWorker && operation.status !== "running") return;
      if (exitDiagnostic) throw new SafeExitError(exitDiagnostic);
      if (claimedByWorker) return;
      if (Date.now() >= deadline) {
        throw new SafeExitError("Local model worker did not claim the queued operation in time.");
      }
      await delay(options.pollIntervalMs);
    }
  } finally {
    child.off("error", onError);
    child.off("exit", onExit);
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs one queued local model operation and records its outcome.
 *
 * Updates operation progress, monitors model downloads for setup operations, executes the
 * curated MFLUX command, and writes worker evidence. Failures mark the operation as failed
 * and are recorded in best-effort evidence without being rethrown.
 *
 * @param projectRoot - The project root containing the local model state and operation queue.
 */
export async function runLocalModelWorker(projectRoot: string): Promise<void> {
  const operation = await claimNextIntent(projectRoot, `studio-${process.pid}`);
  if (!operation) return;
  const startedAt = nowIso();
  try {
    await updateIntentProgress(projectRoot, {
      operationId: operation.operationId,
      progress: { phase: operation.kind === "setup" ? "setting-up" : "verifying" },
    });
    if (operation.kind === "setup") {
      await updateIntentProgress(projectRoot, {
        operationId: operation.operationId,
        progress: { phase: "downloading-model" },
      });
    }
    const stopProgress =
      operation.kind === "setup"
        ? startDownloadProgressMonitor(projectRoot, operation.operationId)
        : async () => undefined;
    const result = await runCuratedMfluxCommand(projectRoot, operation).finally(stopProgress);
    await writeWorkerEvidence(
      projectRoot,
      operation,
      startedAt,
      "succeeded",
      `mflux-${result.operation}-completed`,
      result,
    );
    await completeIntent(projectRoot, { operationId: operation.operationId, status: "succeeded" });
  } catch (error) {
    const diagnostic =
      error instanceof Error ? error.message : "Unknown local MFLUX worker failure.";
    await completeIntent(projectRoot, {
      operationId: operation.operationId,
      status: "failed",
      message: diagnostic.slice(0, 1_000),
    }).catch(() => undefined);
    await writeWorkerEvidence(projectRoot, operation, startedAt, "failed", diagnostic).catch(
      () => undefined,
    );
  }
}

/**
 * Executes the requested curated MFLUX operation with its configured timeout and runtime path.
 *
 * @param operation - The claimed operation to execute, including its kind and optional run identifier.
 * @returns The worker execution result.
 * @throws SafeExitError If a smoke operation has no run identifier for its evidence path.
 */
async function runCuratedMfluxCommand(
  projectRoot: string,
  operation: Awaited<ReturnType<typeof claimNextIntent>> extends infer Value
    ? Exclude<Value, undefined>
    : never,
): ReturnType<typeof executeMfluxWorker> {
  const { modelPath, runtimePath } = localModelStatePaths(projectRoot);
  const outputPath = operation.runId
    ? projectRunPath(projectRoot, operation.runId, "diagnostics", "local-models", "smoke.png")
    : undefined;
  const timeoutMs = localModelWorkerTimeout(operation.kind);
  if (operation.kind === "smoke") {
    if (!outputPath) throw new SafeExitError("Local MFLUX smoke evidence path is missing.");
    return executeMfluxWorker(
      projectRoot,
      { operation: "smoke", modelPath, outputPath, runtimePath },
      timeoutMs,
    );
  }
  return executeMfluxWorker(
    projectRoot,
    { operation: operation.kind, modelPath, runtimePath },
    timeoutMs,
  );
}

function localModelWorkerTimeout(kind: "setup" | "verify" | "smoke"): number {
  if (kind === "setup") return 45 * 60_000;
  if (kind === "verify") return 60_000;
  return 300_000;
}

/**
 * Records worker evidence for an operation associated with a project run.
 *
 * Includes model metadata, timing, outcome, and available install-manifest or smoke-artifact evidence.
 * Diagnostic text is limited to 1,000 characters; optional artifact reads are ignored when unavailable.
 *
 * @param projectRoot - The project root containing the local model state and run data.
 * @param operation - The claimed operation whose evidence is being recorded.
 * @param startedAt - The operation start time in ISO 8601 format.
 * @param status - The operation outcome.
 * @param diagnostic - Diagnostic text describing the outcome.
 * @param result - Optional worker result containing smoke duration data.
 */
async function writeWorkerEvidence(
  projectRoot: string,
  operation: Exclude<Awaited<ReturnType<typeof claimNextIntent>>, undefined>,
  startedAt: string,
  status: "succeeded" | "failed",
  diagnostic: string,
  result?: MfluxWorkerResult,
): Promise<void> {
  if (!operation.runId) return;
  const paths = localModelStatePaths(projectRoot);
  const installManifest = await readFile(paths.installManifestPath).catch(() => undefined);
  const smokePath =
    operation.kind === "smoke"
      ? projectRunPath(projectRoot, operation.runId, "diagnostics", "local-models", "smoke.png")
      : undefined;
  const smoke = smokePath ? await readFile(smokePath).catch(() => undefined) : undefined;
  const model = localModelCatalog[operation.modelId];
  await writeLocalModelWorkerEvidence(projectRoot, operation.runId, {
    schemaVersion: 1,
    operationId: operation.operationId,
    kind: operation.kind,
    model: {
      id: model.id,
      repository: model.modelRepository,
      revision: model.modelRevision,
      runtimeVersion: model.runtimeVersion,
      quantization: model.quantization,
    },
    startedAt,
    finishedAt: nowIso(),
    status,
    diagnostic: diagnostic.slice(0, 1_000),
    ...(installManifest ? { installManifestDigest: sha256(installManifest) } : {}),
    ...(smoke && result?.durationMs !== undefined
      ? {
          smoke: {
            path: "diagnostics/local-models/smoke.png" as const,
            digest: sha256(smoke),
            bytes: smoke.byteLength,
            durationMs: result.durationMs,
          },
        }
      : {}),
  });
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function startDownloadProgressMonitor(
  projectRoot: string,
  operationId: string,
): () => Promise<void> {
  const modelPath = localModelStatePaths(projectRoot).modelPath;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current = Promise.resolve();
  const measure = () => {
    current = directoryBytes(modelPath)
      .then((completedBytes) =>
        updateIntentProgress(projectRoot, {
          operationId,
          progress: { phase: "downloading-model", completedBytes },
        }),
      )
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (!stopped) timer = setTimeout(measure, 2_000);
      });
  };
  measure();
  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await current;
  };
}

async function directoryBytes(target: string): Promise<number> {
  try {
    const entries = await readdir(target, { withFileTypes: true });
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(target, entry.name);
        if (entry.isDirectory()) return directoryBytes(entryPath);
        if (!entry.isFile()) return 0;
        return (await stat(entryPath)).size;
      }),
    );
    return sizes.reduce((total, bytes) => total + bytes, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

if (process.argv[1] === workerSourcePath) {
  const rootIndex = process.argv.indexOf("--project-root");
  const projectRoot = rootIndex >= 0 ? process.argv[rootIndex + 1] : undefined;
  if (!projectRoot) throw new SafeExitError("Local model worker requires a project root.");
  await runLocalModelWorker(projectRoot);
}
