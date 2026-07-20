import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startQueuedLocalModelWorker } from "../src/cli/localModelCommands.js";
import {
  claimNextIntent,
  executeApprovedLocalModelOperation,
  localModelStatePaths,
  prepareLocalModelOperation,
  readOverview,
} from "../src/localModels/localModelReadiness.js";
import {
  launchLocalModelWorker,
  runLocalModelWorker,
} from "../src/localModels/localModelWorker.js";
import { executeMfluxWorker } from "../src/localModels/mfluxProcess.js";

vi.mock("../src/localModels/mfluxProcess.js", () => ({ executeMfluxWorker: vi.fn() }));

const projects: string[] = [];

afterEach(async () => {
  vi.mocked(executeMfluxWorker).mockReset();
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local model worker", () => {
  it("rehydrates an approved setup and writes durable run evidence before readiness", async () => {
    const root = await projectRoot();
    const preparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "setup",
    });
    const operation = await executeApprovedLocalModelOperation(root, {
      runId: preparation.runId,
      bindingDigest: preparation.bindingDigest,
      approvedBy: "Studio operator",
      confirmExecution: true,
    });
    vi.mocked(executeMfluxWorker).mockImplementation(async (_projectRoot, request) => {
      await mkdir(request.runtimePath, { recursive: true });
      if (!request.modelPath) throw new Error("Expected the curated model path.");
      await mkdir(request.modelPath, { recursive: true });
      await writeFile(
        path.join(request.runtimePath, "install-manifest.json"),
        '{"schemaVersion":1}\n',
        "utf8",
      );
      return { status: "ok", operation: "setup" };
    });
    const modelPath = path.join(root, "models", "visual", "mflux", "flux2-klein-4b-q4", "nested");
    await mkdir(modelPath, { recursive: true });
    await writeFile(path.join(modelPath, "weights.bin"), "weights", "utf8");

    await runLocalModelWorker(root);

    await expect(readOverview(root)).resolves.toMatchObject({
      readiness: "ready",
      latestOperation: { operationId: operation.operationId, status: "succeeded" },
    });
    const evidence = JSON.parse(
      await readFile(
        path.join(root, "runs", preparation.runId, "diagnostics", "local-models", "worker.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      operationId: operation.operationId,
      kind: "setup",
      status: "succeeded",
      diagnostic: "mflux-setup-completed",
      installManifestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      model: {
        id: "mflux-flux2-klein-4b-q4",
        revision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
        runtimeVersion: "0.18.0",
      },
    });
  });

  it("returns without invoking MFLUX when no approved operation is queued", async () => {
    const root = await projectRoot();

    await runLocalModelWorker(root);

    expect(executeMfluxWorker).not.toHaveBeenCalled();
  });

  it("runs an approved offline verification with the bounded verify timeout", async () => {
    const root = await projectRoot();
    const preparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "verify",
    });
    const operation = await executeApprovedLocalModelOperation(root, {
      runId: preparation.runId,
      bindingDigest: preparation.bindingDigest,
      approvedBy: "Studio operator",
      confirmExecution: true,
    });
    vi.mocked(executeMfluxWorker).mockResolvedValue({ status: "ok", operation: "verify" });

    await runLocalModelWorker(root);

    expect(executeMfluxWorker).toHaveBeenCalledWith(
      root,
      expect.objectContaining({ operation: "verify" }),
      60_000,
    );
    await expect(readOverview(root)).resolves.toMatchObject({
      latestOperation: { operationId: operation.operationId, status: "succeeded" },
    });
  });

  it("persists approved smoke media and measured timing in worker evidence", async () => {
    const root = await projectRoot();
    const preparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "smoke",
    });
    await executeApprovedLocalModelOperation(root, {
      runId: preparation.runId,
      bindingDigest: preparation.bindingDigest,
      approvedBy: "Studio operator",
      confirmExecution: true,
    });
    vi.mocked(executeMfluxWorker).mockImplementation(async (_projectRoot, request) => {
      if (request.operation !== "smoke") throw new Error("Expected smoke request.");
      await mkdir(path.dirname(request.outputPath), { recursive: true });
      await writeFile(request.outputPath, "png-bytes", "utf8");
      return { status: "ok", operation: "smoke", durationMs: 4_321 };
    });

    await runLocalModelWorker(root);

    const evidence = JSON.parse(
      await readFile(
        path.join(root, "runs", preparation.runId, "diagnostics", "local-models", "worker.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      status: "succeeded",
      smoke: {
        path: "diagnostics/local-models/smoke.png",
        bytes: 9,
        durationMs: 4_321,
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    expect(executeMfluxWorker).toHaveBeenCalledWith(
      root,
      expect.objectContaining({ operation: "smoke" }),
      300_000,
    );
  });

  it("records a bounded worker failure without reporting false readiness", async () => {
    const root = await projectRoot();
    const preparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "verify",
    });
    const operation = await executeApprovedLocalModelOperation(root, {
      runId: preparation.runId,
      bindingDigest: preparation.bindingDigest,
      approvedBy: "Studio operator",
      confirmExecution: true,
    });
    vi.mocked(executeMfluxWorker).mockRejectedValue(new Error("offline verification failed"));

    await runLocalModelWorker(root);

    await expect(readOverview(root)).resolves.toMatchObject({
      readiness: "failed",
      latestOperation: {
        operationId: operation.operationId,
        status: "failed",
        message: "offline verification failed",
      },
    });
    const evidence = JSON.parse(
      await readFile(
        path.join(root, "runs", preparation.runId, "diagnostics", "local-models", "worker.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      operationId: operation.operationId,
      status: "failed",
      diagnostic: "offline verification failed",
    });
  });

  it("rejects startup when the child exits before claiming the queued operation", async () => {
    const root = await projectRoot();
    const operation = await queueApprovedOperation(root, "verify");
    const child = fakeChildProcess(2147483646);
    queueMicrotask(() => child.emit("exit", 1, null));

    await expect(
      launchLocalModelWorker(root, operation.operationId, {
        spawnWorker: () => child,
        startupTimeoutMs: 50,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow(/exited during startup/i);
    await expect(readOverview(root)).resolves.toMatchObject({
      latestOperation: { operationId: operation.operationId, status: "queued" },
    });
  });

  it("turns a claimed worker startup failure into immediate recovery", async () => {
    const root = await projectRoot();
    const operation = await queueApprovedOperation(root, "verify");
    await claimNextIntent(root, "studio-2147483647");

    await expect(
      startQueuedLocalModelWorker(root, operation.operationId, async () => {
        throw new Error("worker bootstrap failed");
      }),
    ).rejects.toThrow("worker bootstrap failed");
    await expect(readOverview(root)).resolves.toMatchObject({
      readiness: "interrupted",
      recoveryAvailable: false,
      latestOperation: { operationId: operation.operationId, status: "interrupted" },
    });
  });
});

async function queueApprovedOperation(root: string, operation: "verify") {
  const preparation = await prepareLocalModelOperation(root, {
    packageId: "mflux-flux2-klein-4b-q4",
    operation,
  });
  return executeApprovedLocalModelOperation(root, {
    runId: preparation.runId,
    bindingDigest: preparation.bindingDigest,
    approvedBy: "Studio operator",
    confirmExecution: true,
  });
}

function fakeChildProcess(pid: number): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  Object.defineProperties(child, {
    pid: { value: pid },
    killed: { value: false, writable: true },
    exitCode: { value: null, writable: true },
    signalCode: { value: null, writable: true },
  });
  child.kill = vi.fn(() => true);
  child.unref = vi.fn();
  return child;
}

async function projectRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykulukscifi-local-worker-"));
  projects.push(root);
  const paths = localModelStatePaths(root);
  await mkdir(paths.runtimePath, { recursive: true });
  return root;
}
