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
