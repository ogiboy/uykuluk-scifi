import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import {
  activateVisualRevision,
  decideVisuals,
  generateLocalVisuals,
  importManualVisual,
  prepareStaticVisuals,
  type LocalVisualGenerationBoundary,
} from "../src/stages/visuals";
import { useTempProject } from "./helpers";
import {
  currentVisualExpectation,
  preparePackagedVisualRun,
  writeTestPng,
} from "./visualTestHelpers";

const settingsDigest = "a".repeat(64);

describe("local visual generation", () => {
  useTempProject();

  it("uses the ready local boundary sequentially and persists reviewable MFLUX revisions", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    const events: string[] = [];
    const boundary: LocalVisualGenerationBoundary = {
      async ensureReady(input) {
        events.push(`ready:${input.sceneIndex}`);
        return {
          runId: input.runId,
          sceneIndex: input.sceneIndex,
          revision: input.revision,
          visualPrompt: input.visualPrompt,
          source: {
            kind: "local-generation",
            service: "mflux",
            modelId: "mlx-community/flux2-klein-4b-4bit",
            modelRevision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
            runtimeRevision: "0.18.0",
            operationId: `local_image_scene_${input.sceneIndex}_revision_${input.revision}`,
            settingsDigest,
            promptDigest: input.promptDigest,
            quantization: "q4",
            seed: 42_000 + input.sceneIndex,
            steps: 4,
            guidance: 1,
            dimensions: { width: 1024, height: 576 },
          },
        };
      },
      async generate(plan) {
        events.push(`generate:${plan.sceneIndex}`);
        return {
          bytes: await sharp({
            create: { width: 1024, height: 576, channels: 3, background: { r: 12, g: 24, b: 48 } },
          })
            .png()
            .toBuffer(),
          durationMs: 120,
          operationId: plan.source.operationId,
        };
      },
    };

    const manifest = await generateLocalVisuals(
      { runId, sceneIndexes: [1, 2], ...(await currentVisualExpectation(runId)) },
      boundary,
    );

    expect(events).toEqual(["ready:1", "generate:1", "ready:2", "generate:2"]);
    for (const sceneIndex of [1, 2]) {
      const scene = manifest.scenes[sceneIndex - 1];
      const revision = scene.revisions.at(-1);
      expect(revision).toMatchObject({
        revision: 2,
        provider: "mflux-local",
        media: { width: 1024, height: 576, format: "png" },
        source: {
          kind: "local-generation",
          operationId: `local_image_scene_${sceneIndex}_revision_2`,
          promptDigest: scene.promptDigest,
          quantization: "q4",
          settingsDigest,
          durationMs: 120,
        },
      });
      expect(scene.decision).toBeUndefined();
      expect(artifactPath(runId, revision!.asset.path)).toContain("revision_002.png");
    }
    expect((await loadRun(runId)).artifacts).not.toContain("production/render_plan.json");
  });

  it("rejects stale ready plans without invoking local generation", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    let generated = false;
    const boundary: LocalVisualGenerationBoundary = {
      async ensureReady(input) {
        return {
          runId: input.runId,
          sceneIndex: input.sceneIndex,
          revision: input.revision,
          visualPrompt: "stale prompt",
          source: {
            kind: "local-generation",
            service: "mflux",
            modelId: "model",
            modelRevision: "revision",
            runtimeRevision: "runtime",
            operationId: "local_image_stale_plan",
            settingsDigest,
            promptDigest: input.promptDigest,
            quantization: "q4",
            seed: 1,
            steps: 4,
            guidance: 1,
            dimensions: { width: 1024, height: 576 },
          },
        };
      },
      async generate() {
        generated = true;
        throw new Error("must not generate");
      },
    };
    await expect(
      generateLocalVisuals(
        { runId, sceneIndexes: [1], ...(await currentVisualExpectation(runId)) },
        boundary,
      ),
    ).rejects.toThrow(/stale launch data/i);
    expect(generated).toBe(false);
  });

  it("activates an existing revision, clears its prior decision, and invalidates render consumers", async () => {
    const runId = await preparePackagedVisualRun();
    const initial = await prepareStaticVisuals(runId);
    await decideVisuals({
      runId,
      sceneIndexes: initial.scenes.map((scene) => scene.sceneIndex),
      status: "approved",
      reviewedBy: "test-operator",
      notes: "Initial revisions are approved.",
      ...(await currentVisualExpectation(runId)),
    });
    await writeTestPng("historical-revision.png");
    await importManualVisual({
      runId,
      sceneIndex: 1,
      sourcePath: "historical-revision.png",
      ...(await currentVisualExpectation(runId)),
    });
    const updated = await activateVisualRevision({
      runId,
      sceneIndex: 1,
      revision: 1,
      ...(await currentVisualExpectation(runId)),
    });
    expect(updated.scenes[0]).toMatchObject({ activeRevision: 1, decision: undefined });
    expect((await loadRun(runId)).artifacts).not.toContain("production/render_plan.json");
  });

  it("allocates after the highest historical revision when an older candidate is active", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await writeTestPng("historical-local-revision.png");
    await importManualVisual({
      runId,
      sceneIndex: 1,
      sourcePath: "historical-local-revision.png",
      ...(await currentVisualExpectation(runId)),
    });
    await activateVisualRevision({
      runId,
      sceneIndex: 1,
      revision: 1,
      ...(await currentVisualExpectation(runId)),
    });
    const boundary: LocalVisualGenerationBoundary = {
      async ensureReady(input) {
        return {
          runId: input.runId,
          sceneIndex: input.sceneIndex,
          revision: input.revision,
          visualPrompt: input.visualPrompt,
          source: {
            kind: "local-generation",
            service: "mflux",
            modelId: "mlx-community/flux2-klein-4b-4bit",
            modelRevision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
            runtimeRevision: "0.18.0",
            operationId: `local_image_scene_${input.sceneIndex}_revision_${input.revision}`,
            settingsDigest,
            promptDigest: input.promptDigest,
            quantization: "q4",
            seed: 42_000 + input.sceneIndex,
            steps: 4,
            guidance: 1,
            dimensions: { width: 1024, height: 576 },
          },
        };
      },
      async generate(plan) {
        return {
          bytes: await sharp({
            create: { width: 1024, height: 576, channels: 3, background: { r: 24, g: 36, b: 60 } },
          })
            .png()
            .toBuffer(),
          durationMs: 90,
          operationId: plan.source.operationId,
        };
      },
    };

    const manifest = await generateLocalVisuals(
      { runId, sceneIndexes: [1], ...(await currentVisualExpectation(runId)) },
      boundary,
    );

    expect(manifest.scenes[0]).toMatchObject({ activeRevision: 3 });
    expect(manifest.scenes[0]!.revisions.map((revision) => revision.revision)).toEqual([1, 2, 3]);
  });
});
