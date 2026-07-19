import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SafeExitError } from "../core/errors.js";
import { projectRunPath } from "../core/runPaths.js";
import { nowIso } from "../utils/time.js";
import { localModelCatalog } from "./localModelContracts.js";
import { claimNextIntent, completeIntent, updateIntentProgress } from "./localModelReadiness.js";
import { localModelStatePaths, writeLocalModelWorkerEvidence } from "./localModelStore.js";
import { executeMfluxWorker, type MfluxWorkerResult } from "./mfluxProcess.js";

const workerSourcePath = fileURLToPath(import.meta.url);

/**
 * Starts one detached, curated MFLUX worker. It accepts no package, prompt, model, or shell input.
 */
export function launchLocalModelWorker(projectRoot: string): Readonly<{ pid: number }> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", workerSourcePath, "--project-root", path.resolve(projectRoot)],
    { cwd: path.resolve(projectRoot), detached: true, stdio: "ignore" },
  );
  if (!child.pid) throw new SafeExitError("Local model worker could not be started.");
  child.unref();
  return { pid: child.pid };
}

/** Runs the fixed local worker once; process restarts rehydrate queued operations through this entrypoint. */
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

async function runCuratedMfluxCommand(
  projectRoot: string,
  operation: Awaited<ReturnType<typeof claimNextIntent>> extends infer Value
    ? Exclude<Value, undefined>
    : never,
): ReturnType<typeof executeMfluxWorker> {
  const runtimePath = localModelStatePaths(projectRoot).runtimePath;
  const outputPath = operation.runId
    ? projectRunPath(projectRoot, operation.runId, "diagnostics", "local-models", "smoke.png")
    : undefined;
  const timeoutMs =
    operation.kind === "setup" ? 45 * 60_000 : operation.kind === "verify" ? 60_000 : 300_000;
  if (operation.kind === "smoke") {
    if (!outputPath) throw new SafeExitError("Local MFLUX smoke evidence path is missing.");
    return executeMfluxWorker(
      projectRoot,
      { operation: "smoke", outputPath, runtimePath },
      timeoutMs,
    );
  }
  return executeMfluxWorker(projectRoot, { operation: operation.kind, runtimePath }, timeoutMs);
}

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
  const modelPath = path.join(localModelStatePaths(projectRoot).runtimePath, "model");
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
