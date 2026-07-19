import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  claimNextIntent,
  completeIntent,
  executeApprovedLocalModelOperation,
  localModelStatePaths,
  prepareLocalModelOperation,
  readOverview,
  recoverInterruptedIntents,
  submitIntent,
  updateIntentProgress,
} from "../src/localModels/localModelReadiness.js";

const projects: string[] = [];

afterEach(async () => {
  await Promise.all(
    projects
      .splice(0)
      .map(async (projectRoot) => rm(projectRoot, { recursive: true, force: true })),
  );
});

describe("local MFLUX readiness", () => {
  it("reports the curated local model as absent before a setup intent exists", async () => {
    const overview = await readOverview(await projectRoot());

    expect(overview).toMatchObject({
      readiness: "absent",
      catalog: [
        {
          id: "mflux-flux2-klein-4b-q4",
          runtimeVersion: "0.18.0",
          modelRepository: "mlx-community/flux2-klein-4b-4bit",
          modelRevision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
        },
      ],
    });
  });

  it("distinguishes queued and running setup without starting a package install", async () => {
    const root = await projectRoot();
    await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" });

    await expect(readOverview(root)).resolves.toMatchObject({ readiness: "setup-pending" });
    await claimNextIntent(root, "studio-worker");
    await expect(readOverview(root)).resolves.toMatchObject({ readiness: "setup-running" });
  });

  it("marks an orphaned running operation as interrupted for rehydration", async () => {
    const root = await projectRoot();
    await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" });
    await claimNextIntent(root, "stopped-worker");

    await expect(readOverview(root)).resolves.toMatchObject({ recoveryAvailable: true });
    await expect(recoverInterruptedIntents(root)).resolves.toBe(1);
    await expect(readOverview(root)).resolves.toMatchObject({
      readiness: "interrupted",
      recoveryAvailable: false,
    });
  });

  it("persists worker-provided download bytes without inventing a percentage", async () => {
    const root = await projectRoot();
    const queued = await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" });
    await claimNextIntent(root, "progress-worker");
    await updateIntentProgress(root, {
      operationId: queued.operationId,
      progress: { phase: "downloading-model", completedBytes: 1_024, totalBytes: 4_096 },
    });

    await expect(readOverview(root)).resolves.toMatchObject({
      progress: { phase: "downloading-model", completedBytes: 1_024, totalBytes: 4_096 },
    });
  });

  it("reports ready only after a trusted setup completion writes the fixed marker", async () => {
    const root = await projectRoot();
    await writeInstallManifestPlaceholder(root);
    const queued = await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" });
    await claimNextIntent(root, "verified-worker");
    await completeIntent(root, { operationId: queued.operationId, status: "succeeded" });

    await expect(readOverview(root)).resolves.toMatchObject({ readiness: "ready" });
  });

  it("clears stale readiness after an offline verification failure", async () => {
    const root = await projectRoot();
    await writeInstallManifestPlaceholder(root);
    const setup = await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" });
    await claimNextIntent(root, "setup-worker");
    await completeIntent(root, { operationId: setup.operationId, status: "succeeded" });
    const verify = await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "verify" });
    await claimNextIntent(root, "verify-worker");
    await completeIntent(root, { operationId: verify.operationId, status: "failed" });

    await expect(readOverview(root)).resolves.toMatchObject({ readiness: "failed" });
  });

  it("rejects unknown packages instead of accepting browser-selected runtime data", async () => {
    await expect(
      submitIntent(await projectRoot(), {
        modelId: "unreviewed-model" as "mflux-flux2-klein-4b-q4",
        kind: "setup",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("Unknown local model package") });
  });

  it("permits only one queued or running heavy operation at a time", async () => {
    const root = await projectRoot();
    const settled = await Promise.allSettled([
      submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" }),
      submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "verify" }),
    ]);

    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("requires an exact persisted preparation and explicit approval before queueing work", async () => {
    const root = await projectRoot();
    const preparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "setup",
    });
    await expect(readOverview(root)).resolves.toMatchObject({
      preparation: {
        runId: preparation.runId,
        bindingDigest: preparation.bindingDigest,
        estimatedDiskBytes: 6_500_000_000,
        estimatedDurationSeconds: 600,
        estimatedUsdMicros: 0,
      },
    });
    const operation = await executeApprovedLocalModelOperation(root, {
      runId: preparation.runId,
      bindingDigest: preparation.bindingDigest,
      approvedBy: "operator",
      confirmExecution: true,
    });
    const execution = await readFile(
      path.join(root, "runs", preparation.runId, "diagnostics", "local-models", "execution.json"),
      "utf8",
    );

    expect(operation).toMatchObject({ status: "queued", kind: "setup" });
    expect(JSON.parse(execution)).toMatchObject({
      bindingDigest: preparation.bindingDigest,
      approvedBy: "operator",
      operationId: operation.operationId,
    });
    await expect(readOverview(root)).resolves.toMatchObject({ preparation: undefined });
  });

  it("prepares the bounded 1024x576 local smoke as a distinct closed operation", async () => {
    const preparation = await prepareLocalModelOperation(await projectRoot(), {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "smoke",
    });

    expect(preparation).toMatchObject({
      estimatedUsdMicros: 0,
      estimatedDurationSeconds: 180,
      estimatedDiskBytes: 8_388_608,
      operation: "smoke",
    });
  });

  it("rejects an older browser preparation after a newer preflight replaces it", async () => {
    const root = await projectRoot();
    const stale = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "setup",
    });
    const current = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "verify",
    });

    await expect(
      executeApprovedLocalModelOperation(root, {
        runId: stale.runId,
        bindingDigest: stale.bindingDigest,
        approvedBy: "operator",
        confirmExecution: true,
      }),
    ).rejects.toThrow(/stale/i);
    await expect(readOverview(root)).resolves.toMatchObject({
      preparation: { runId: current.runId },
    });
  });

  it("recovers a dead approved worker into durable evidence before preparing a new plan", async () => {
    const root = await projectRoot();
    const interruptedPreparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "setup",
    });
    const interruptedOperation = await executeApprovedLocalModelOperation(root, {
      runId: interruptedPreparation.runId,
      bindingDigest: interruptedPreparation.bindingDigest,
      approvedBy: "operator",
      confirmExecution: true,
    });
    await claimNextIntent(root, "stopped-worker");

    const replacement = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "setup",
    });
    const recovery = JSON.parse(
      await readFile(
        path.join(
          root,
          "runs",
          interruptedPreparation.runId,
          "diagnostics",
          "local-models",
          "recovery.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(replacement.runId).not.toBe(interruptedPreparation.runId);
    expect(recovery).toMatchObject({
      operationId: interruptedOperation.operationId,
      previousStatus: "running",
      reason: "worker-not-running",
    });
  });

  it("does not recover or replace a worker that is still alive", async () => {
    const root = await projectRoot();
    await submitIntent(root, { modelId: "mflux-flux2-klein-4b-q4", kind: "setup" });
    await claimNextIntent(root, `studio-${process.pid}`);

    await expect(readOverview(root)).resolves.toMatchObject({ recoveryAvailable: false });
    await expect(
      prepareLocalModelOperation(root, {
        packageId: "mflux-flux2-klein-4b-q4",
        operation: "setup",
      }),
    ).rejects.toThrow(/already in progress/i);
  });

  it("keeps app-managed model state outside run evidence", async () => {
    const root = await projectRoot();
    const paths = localModelStatePaths(root);

    expect(paths.runtimePath).toBe(path.join(root, ".local-models", "mflux"));
    expect(paths.runtimePath.startsWith(path.join(root, "runs"))).toBe(false);
  });
});

async function projectRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykulukscifi-local-model-"));
  projects.push(root);
  return root;
}

async function writeInstallManifestPlaceholder(root: string): Promise<void> {
  const paths = localModelStatePaths(root);
  await mkdir(paths.runtimePath, { recursive: true });
  await writeFile(paths.installManifestPath, "{}\n", "utf8");
}
