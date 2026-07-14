import { readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, expectTypeOf, it } from "vitest";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun, mutateRun } from "../src/core/runStore";
import { generateRenderPlan } from "../src/stages/renderPlan";
import {
  decideVisuals,
  importManualVisual,
  prepareStaticVisuals,
  regenerateRejectedStaticVisuals,
  type VisualMutationExpectation,
} from "../src/stages/visuals";
import { captureVisualArtifactRollback } from "../src/stages/visuals/visualArtifactRollback";
import { readApprovedVisualManifestEvidence } from "../src/stages/visuals/visualManifest";
import { visualMutationRollbackPaths } from "../src/stages/visuals/visualPersistence";
import { writeBinaryFile } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import {
  currentVisualExpectation,
  preparePackagedVisualRun,
  writeTestPng,
} from "./visualTestHelpers";

describe("scene visual workflow", () => {
  useTempProject();

  it("requires exact mutation expectations at the public type boundary", () => {
    expectTypeOf<Parameters<typeof decideVisuals>[0]>().toMatchTypeOf<VisualMutationExpectation>();
    expectTypeOf<
      Parameters<typeof importManualVisual>[0]
    >().toMatchTypeOf<VisualMutationExpectation>();
    expectTypeOf<
      Parameters<typeof regenerateRejectedStaticVisuals>[0]
    >().toMatchTypeOf<VisualMutationExpectation>();
  });

  it("prepares static revisions, requires review, and binds approved visuals into render planning", async () => {
    const runId = await preparePackagedVisualRun();
    const manifest = await prepareStaticVisuals(runId);

    expect(manifest.scenes.length).toBeGreaterThanOrEqual(12);
    expect(manifest.scenes.length).toBeLessThanOrEqual(24);
    expect(manifest.scenes[0]).toMatchObject({
      activeRevision: 1,
      revisions: [
        {
          provider: "static",
          asset: { role: "scene-visual", path: expect.stringContaining("assets/backgrounds/") },
          motion: { kind: "slow-zoom-in", seed: 10_001 },
        },
      ],
    });
    expect(manifest.scenes[0].decision).toBeUndefined();
    await expect(generateRenderPlan(runId)).rejects.toThrow(/visual review is incomplete/i);

    await decideVisuals({
      runId,
      sceneIndexes: manifest.scenes.map((scene) => scene.sceneIndex),
      status: "approved",
      reviewedBy: "visual-reviewer",
      notes: "Approved static fallback contact sheet.",
      ...(await currentVisualExpectation(runId)),
    });
    const evidence = await readApprovedVisualManifestEvidence(await loadRun(runId));
    expect(evidence).toMatchObject({
      status: "pass",
      approvedSceneCount: manifest.scenes.length,
      sceneCount: manifest.scenes.length,
    });

    const plan = await generateRenderPlan(runId);
    expect(plan.schemaVersion).toBe(2);
    if (plan.schemaVersion !== 2) {
      throw new Error("Expected a visual-bound render plan.");
    }
    expect(plan.visualManifest.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.scenes).toHaveLength(manifest.scenes.length);
    expect(plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0)).toBe(
      manifest.scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    );
    expect(plan.scenes[0]).toMatchObject({
      visualRevision: 1,
      motion: { kind: "slow-zoom-in" },
      backgroundAsset: { role: "scene-visual" },
    });
  });

  it("imports a manual scene revision, resets its decision, and invalidates the stale render plan", async () => {
    const runId = await preparePackagedVisualRun();
    const initial = await prepareStaticVisuals(runId);
    await decideVisuals({
      runId,
      sceneIndexes: initial.scenes.map((scene) => scene.sceneIndex),
      status: "approved",
      reviewedBy: "visual-reviewer",
      notes: "Initial contact sheet approved.",
      ...(await currentVisualExpectation(runId)),
    });
    await generateRenderPlan(runId);
    const source = "manual-scene.png";
    await writeTestPng(source);

    const updated = await importManualVisual({
      runId,
      sceneIndex: 1,
      sourcePath: source,
      ...(await currentVisualExpectation(runId)),
    });
    const scene = updated.scenes.find((item) => item.sceneIndex === 1);
    expect(scene).toMatchObject({
      activeRevision: 2,
      decision: undefined,
      revisions: [
        { revision: 1, provider: "static" },
        {
          revision: 2,
          provider: "manual-import",
          asset: { path: "production/visuals/scenes/scene_001/revision_002.png" },
          media: { format: "png", width: 1920, height: 1080, bytes: expect.any(Number) },
        },
      ],
    });
    const run = await loadRun(runId);
    expect(run.artifacts).not.toContain("production/render_plan.json");
    await expect(readApprovedVisualManifestEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringMatching(/incomplete/i),
    });
  });

  it("blocks tampered manual visual bytes and undersized imports", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await writeTestPng("manual-scene.png");
    const updated = await importManualVisual({
      runId,
      sceneIndex: 1,
      sourcePath: "manual-scene.png",
      ...(await currentVisualExpectation(runId)),
    });
    const manualPath = updated.scenes[0].revisions.at(-1)?.asset.path;
    expect(manualPath).toBeTruthy();
    await writeFile(artifactPath(runId, manualPath!), "tampered", "utf8");
    await expect(readApprovedVisualManifestEvidence(await loadRun(runId))).resolves.toMatchObject({
      status: "block",
      message: expect.stringMatching(/changed after evidence/i),
    });

    const secondRunId = await preparePackagedVisualRun();
    await prepareStaticVisuals(secondRunId);
    await writeTestPng("small.png", 640, 360);
    await expect(
      importManualVisual({
        runId: secondRunId,
        sceneIndex: 1,
        sourcePath: "small.png",
        ...(await currentVisualExpectation(secondRunId)),
      }),
    ).rejects.toThrow(/at least 1280x720/i);
    expect((await readFile("small.png")).byteLength).toBeGreaterThan(24);
  });

  it("rejects truncated image headers and stale visual mutation expectations", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    const stale = await currentVisualExpectation(runId);
    await decideVisuals({
      runId,
      sceneIndexes: [1],
      status: "rejected",
      reviewedBy: "visual-reviewer",
      notes: "Needs a different visual rhythm.",
      ...stale,
    });
    await expect(
      decideVisuals({
        runId,
        sceneIndexes: [2],
        status: "approved",
        reviewedBy: "visual-reviewer",
        notes: "This operation used stale evidence.",
        ...stale,
      }),
    ).rejects.toThrow(/manifest changed/i);

    const current = await currentVisualExpectation(runId);
    await expect(
      decideVisuals({
        runId,
        sceneIndexes: [2],
        status: "approved",
        reviewedBy: "visual-reviewer",
        notes: "This operation used a stale scene revision.",
        ...current,
        expectedActiveRevisions: current.expectedActiveRevisions.map((item) =>
          item.sceneIndex === 1 ? { ...item, activeRevision: item.activeRevision + 1 } : item,
        ),
      }),
    ).rejects.toThrow(/scene 1 changed revision/i);
    await expect(
      decideVisuals({
        runId,
        sceneIndexes: [2],
        status: "approved",
        reviewedBy: "visual-reviewer",
        notes: "This operation omitted part of the revision snapshot.",
        ...current,
        expectedActiveRevisions: current.expectedActiveRevisions.slice(1),
      }),
    ).rejects.toThrow(/include every scene exactly once/i);

    const truncated = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(truncated, 0);
    truncated.writeUInt32BE(1920, 16);
    truncated.writeUInt32BE(1080, 20);
    await writeFile("truncated.png", truncated);
    await expect(
      importManualVisual({
        runId,
        sceneIndex: 1,
        sourcePath: "truncated.png",
        ...(await currentVisualExpectation(runId)),
      }),
    ).rejects.toThrow(/supported PNG or JPEG/i);

    await writeTestPng("valid-stale.png");
    await expect(
      importManualVisual({ runId, sceneIndex: 1, sourcePath: "valid-stale.png", ...stale }),
    ).rejects.toThrow(/manifest changed/i);
    await expect(
      readFile(artifactPath(runId, "production/visuals/scenes/scene_001/revision_002.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("regenerates rejected static scenes as exact next revisions and resets decisions", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await decideVisuals({
      runId,
      sceneIndexes: [1],
      status: "rejected",
      reviewedBy: "visual-reviewer",
      notes: "Try the next deterministic fallback revision.",
      ...(await currentVisualExpectation(runId)),
    });

    const updated = await regenerateRejectedStaticVisuals({
      runId,
      sceneIndexes: [1],
      ...(await currentVisualExpectation(runId)),
    });
    expect(updated.scenes[0]).toMatchObject({
      activeRevision: 2,
      decision: undefined,
      revisions: [
        { revision: 1, provider: "static", motion: { kind: "slow-zoom-in" } },
        { revision: 2, provider: "static", motion: { kind: "slow-pan-left" } },
      ],
    });
  });

  it("restores the complete visual artifact set after failures at every mutation phase", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await mutateRun(runId, async (current) => ({
      run: await writeRunText(
        current,
        "test-visual-rollback",
        "production/render_plan.json",
        "original render plan",
      ),
      value: null,
    }));
    const manifestPath = artifactPath(runId, "production/visuals/manifest.json");
    const contactPath = artifactPath(runId, "production/visuals/contact_sheet.md");
    const consumerPath = artifactPath(runId, "production/render_plan.json");
    const baseline = {
      manifest: await readFile(manifestPath),
      contact: await readFile(contactPath),
      consumer: await readFile(consumerPath),
    };

    for (const phase of ["binary", "manifest", "contact", "state"] as const) {
      const pendingAsset = "production/visuals/scenes/scene_001/revision_099.png";
      await expect(
        mutateRun(runId, async (current, transaction) => {
          transaction.onRollback(
            await captureVisualArtifactRollback(runId, "test-visual-rollback", [
              ...visualMutationRollbackPaths,
              pendingAsset,
            ]),
          );
          await writeBinaryFile(artifactPath(runId, pendingAsset), Buffer.from("pending binary"));
          if (phase === "binary") throw new Error("injected after binary");
          await writeFile(manifestPath, "replacement manifest");
          if (phase === "manifest") throw new Error("injected after manifest");
          await writeFile(contactPath, "replacement contact sheet");
          if (phase === "contact") throw new Error("injected after contact");
          await rm(consumerPath);
          return {
            run: {
              ...current,
              updatedAt: new Date(Date.parse(current.updatedAt) + 1_000).toISOString(),
            },
            value: null,
          };
        }),
      ).rejects.toThrow(phase === "state" ? /run state changed/i : `injected after ${phase}`);

      await expect(readFile(manifestPath)).resolves.toEqual(baseline.manifest);
      await expect(readFile(contactPath)).resolves.toEqual(baseline.contact);
      await expect(readFile(consumerPath)).resolves.toEqual(baseline.consumer);
      await expect(readFile(artifactPath(runId, pendingAsset))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(loadRun(runId)).resolves.toMatchObject({
        artifacts: expect.arrayContaining(["production/render_plan.json"]),
      });
      const rollbackEvent = (await readLedger(runId)).at(-1);
      expect(rollbackEvent).toMatchObject({
        type: "ARTIFACT_ROLLBACK",
        stage: "test-visual-rollback",
        data: {
          failure: expect.stringMatching(
            phase === "state" ? /run state changed/i : new RegExp(`injected after ${phase}`, "i"),
          ),
          paths: expect.arrayContaining([pendingAsset, "production/visuals/manifest.json"]),
        },
      });
    }
  });
});
