import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config.js";
import { localModelCatalog } from "../src/localModels/localModelContracts.js";
import { createMfluxVisualGenerationBoundary } from "../src/localModels/mfluxVisualGenerationBoundary.js";

const projects: string[] = [];

afterEach(async () => {
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("MFLUX visual generation boundary", () => {
  it("uses only server-owned generation inputs and returns measured local output", async () => {
    const root = await projectRoot();
    let executionCount = 0;
    const boundary = createMfluxVisualGenerationBoundary(
      root,
      defaultConfig.providers.imageGeneration.mflux,
      {
        async readLocalOverview() {
          return readyOverview(root);
        },
        async executeWorker(_projectRoot, request) {
          expect(request.operation).toBe("generate");
          if (request.operation !== "generate") throw new Error("Expected generation request.");
          executionCount += 1;
          await expect(readFile(request.promptPath, "utf8")).resolves.toBe(
            "A scientifically accurate orbital observatory.",
          );
          await writeFile(
            request.outputPath,
            await sharp({
              create: {
                width: 1024,
                height: 576,
                channels: 3,
                background: { r: 10, g: 20, b: 30 },
              },
            })
              .png()
              .toBuffer(),
          );
          return { status: "ok", operation: "generate", durationMs: 1_234 };
        },
      },
    );
    const plan = await boundary.ensureReady({
      runId: "run_local_boundary",
      sceneIndex: 2,
      revision: 3,
      visualPrompt: "A scientifically accurate orbital observatory.",
      promptDigest: "a".repeat(64),
    });
    const generated = await boundary.generate(plan);
    const recovered = await boundary.generate(plan);

    expect(executionCount).toBe(1);
    expect(plan.source).toMatchObject({
      operationId: expect.stringMatching(/^local_image_[a-f0-9]{64}$/),
      seed: 62_003,
      settingsDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(generated).toMatchObject({ durationMs: 1_234, operationId: plan.source.operationId });
    expect(recovered).toEqual(generated);
    expect(generated.bytes.byteLength).toBeGreaterThan(0);
    await expect(
      readdir(path.join(root, "runs", "run_local_boundary", "diagnostics", "local-visuals")),
    ).resolves.toEqual([`${plan.source.operationId}.json`, `${plan.source.operationId}.png`]);
    await expect(readdir(path.join(root, ".local-models", "mflux", "jobs"))).resolves.toEqual([]);
  });

  it("fails before inference when the Studio-managed runtime is not ready", async () => {
    const root = await projectRoot();
    const boundary = createMfluxVisualGenerationBoundary(
      root,
      defaultConfig.providers.imageGeneration.mflux,
      {
        async readLocalOverview() {
          return { ...readyOverview(root), readiness: "absent" as const };
        },
        async executeWorker() {
          throw new Error("must not execute");
        },
      },
    );

    await expect(
      boundary.ensureReady({
        runId: "run_local_boundary",
        sceneIndex: 1,
        revision: 2,
        visualPrompt: "A local visual.",
        promptDigest: "b".repeat(64),
      }),
    ).rejects.toThrow(/not ready/i);
  });

  it("rejects a worker result that omits measured generation timing and cleans its job", async () => {
    const root = await projectRoot();
    const boundary = createMfluxVisualGenerationBoundary(
      root,
      defaultConfig.providers.imageGeneration.mflux,
      {
        async readLocalOverview() {
          return readyOverview(root);
        },
        async executeWorker(_projectRoot, request) {
          if (request.operation !== "generate") throw new Error("Expected generation request.");
          await writeFile(request.outputPath, await imageBytes());
          return { status: "ok", operation: "generate" };
        },
      },
    );
    const plan = await readyPlan(boundary, "run_missing_timing");

    await expect(boundary.generate(plan)).rejects.toThrow(/timing evidence/i);
    await expect(readdir(path.join(root, ".local-models", "mflux", "jobs"))).resolves.toEqual([]);
  });

  it("fails closed when recovery has only one of its paired artifacts", async () => {
    const root = await projectRoot();
    const boundary = successfulBoundary(root);
    const plan = await readyPlan(boundary, "run_partial_recovery");
    const paths = recoveryPaths(root, plan);
    await mkdir(path.dirname(paths.image), { recursive: true });
    await writeFile(paths.image, await imageBytes());

    await expect(boundary.generate(plan)).rejects.toThrow(/recovery evidence is incomplete/i);
  });

  it("rejects invalid, stale, and media-mismatched recovery evidence", async () => {
    const invalidRoot = await projectRoot();
    const invalidBoundary = successfulBoundary(invalidRoot);
    const invalidPlan = await readyPlan(invalidBoundary, "run_invalid_recovery");
    await invalidBoundary.generate(invalidPlan);
    const invalidPaths = recoveryPaths(invalidRoot, invalidPlan);
    await writeFile(invalidPaths.evidence, "not-json\n", "utf8");
    await expect(invalidBoundary.generate(invalidPlan)).rejects.toThrow(
      /recovery evidence is invalid/i,
    );

    const staleRoot = await projectRoot();
    const staleBoundary = successfulBoundary(staleRoot);
    const stalePlan = await readyPlan(staleBoundary, "run_stale_recovery");
    await staleBoundary.generate(stalePlan);
    const stalePaths = recoveryPaths(staleRoot, stalePlan);
    const staleEvidence = JSON.parse(await readFile(stalePaths.evidence, "utf8")) as Record<
      string,
      unknown
    >;
    await writeFile(
      stalePaths.evidence,
      `${JSON.stringify({ ...staleEvidence, promptDigest: "f".repeat(64) }, null, 2)}\n`,
      "utf8",
    );
    await expect(staleBoundary.generate(stalePlan)).rejects.toThrow(/recovery evidence is stale/i);

    const mediaRoot = await projectRoot();
    const mediaBoundary = successfulBoundary(mediaRoot);
    const mediaPlan = await readyPlan(mediaBoundary, "run_media_mismatch");
    await mediaBoundary.generate(mediaPlan);
    const mediaPaths = recoveryPaths(mediaRoot, mediaPlan);
    await writeFile(mediaPaths.image, "tampered-image", "utf8");
    await expect(mediaBoundary.generate(mediaPlan)).rejects.toThrow(/recovery media is invalid/i);
  });

  it("reclaims an abandoned generation lock but rejects a live owner", async () => {
    const abandonedRoot = await projectRoot();
    const abandonedBoundary = successfulBoundary(abandonedRoot);
    const abandonedPlan = await readyPlan(abandonedBoundary, "run_abandoned_lock");
    const abandonedLock = path.join(abandonedRoot, ".local-models", "mflux", "generation.lock");
    await writeFile(abandonedLock, `${JSON.stringify({ pid: 2_147_483_647 })}\n`, "utf8");

    await expect(abandonedBoundary.generate(abandonedPlan)).resolves.toMatchObject({
      operationId: abandonedPlan.source.operationId,
    });

    const liveRoot = await projectRoot();
    const liveBoundary = successfulBoundary(liveRoot);
    const livePlan = await readyPlan(liveBoundary, "run_live_lock");
    const liveLock = path.join(liveRoot, ".local-models", "mflux", "generation.lock");
    await writeFile(liveLock, `${JSON.stringify({ pid: process.pid })}\n`, "utf8");

    await expect(liveBoundary.generate(livePlan)).rejects.toThrow(/already running/i);
  });
});

async function projectRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykulukscifi-mflux-boundary-"));
  projects.push(root);
  await mkdir(path.join(root, ".local-models", "mflux"), { recursive: true });
  return root;
}

function readyOverview(root: string) {
  return {
    catalog: Object.values(localModelCatalog),
    readiness: "ready" as const,
    recoveryAvailable: false,
    runtimePath: path.join(root, ".local-models", "mflux"),
    nextAction: "Ready.",
  };
}

function successfulBoundary(root: string) {
  return createMfluxVisualGenerationBoundary(root, defaultConfig.providers.imageGeneration.mflux, {
    async readLocalOverview() {
      return readyOverview(root);
    },
    async executeWorker(_projectRoot, request) {
      if (request.operation !== "generate") throw new Error("Expected generation request.");
      await writeFile(request.outputPath, await imageBytes());
      return { status: "ok", operation: "generate", durationMs: 987 };
    },
  });
}

async function readyPlan(
  boundary: ReturnType<typeof createMfluxVisualGenerationBoundary>,
  runId: string,
) {
  return boundary.ensureReady({
    runId,
    sceneIndex: 1,
    revision: 2,
    visualPrompt: "A precise local science visual.",
    promptDigest: "c".repeat(64),
  });
}

function recoveryPaths(
  root: string,
  plan: Awaited<ReturnType<ReturnType<typeof createMfluxVisualGenerationBoundary>["ensureReady"]>>,
) {
  const directory = path.join(root, "runs", plan.runId, "diagnostics", "local-visuals");
  return {
    evidence: path.join(directory, `${plan.source.operationId}.json`),
    image: path.join(directory, `${plan.source.operationId}.png`),
  };
}

function imageBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 36, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}
