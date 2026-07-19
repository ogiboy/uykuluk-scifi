import { createHash } from "node:crypto";

import { z } from "zod";
import { writeRunBinary } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../../core/runLedgerOutbox.js";
import { loadRun, mutateRun } from "../../core/runStore.js";
import { nowIso } from "../../utils/time.js";
import { captureVisualArtifactRollback } from "./visualArtifactRollback.js";
import {
  localVisualSourceSchema,
  visualManifestSchema,
  type VisualManifest,
  type VisualRevision,
} from "./visualContracts.js";
import { inspectVisualImage } from "./visualImageMetadata.js";
import { loadVisualManifest } from "./visualManifest.js";
import { deterministicVisualMotion } from "./visualMotion.js";
import {
  assertVisualMutationExpectation,
  type VisualMutationExpectation,
} from "./visualMutationExpectation.js";
import {
  invalidateVisualConsumers,
  persistVisualManifest,
  visualMutationRollbackPaths,
} from "./visualPersistence.js";
import { requireVisualReviewState } from "./visualReviewState.js";
import { visualRevisionPath } from "./visualRevisions.js";

const localVisualLaunchSourceSchema = localVisualSourceSchema.omit({ durationMs: true });

const localVisualLaunchPlanSchema = z.strictObject({
  runId: z.string().min(1),
  sceneIndex: z.int().positive().max(24),
  revision: z.int().positive(),
  visualPrompt: z.string().min(1),
  source: localVisualLaunchSourceSchema,
});

const localVisualGeneratedImageSchema = z.strictObject({
  bytes: z.instanceof(Buffer).refine((bytes) => bytes.byteLength > 0, "Generated image is empty."),
  durationMs: localVisualSourceSchema.shape.durationMs,
  operationId: localVisualLaunchPlanSchema.shape.source.shape.operationId,
});

export type LocalVisualLaunchPlan = z.infer<typeof localVisualLaunchPlanSchema>;
export type LocalVisualGeneratedImage = z.infer<typeof localVisualGeneratedImageSchema>;

/**
 * Typed bridge to the local-model owner.
 *
 * Core visual workflow code does not spawn Python, download models, or inspect a
 * machine-specific runtime. The local-model service verifies readiness and returns
 * an immutable launch plan; it then fulfils one plan at a time.
 */
export interface LocalVisualGenerationBoundary {
  ensureReady(input: {
    runId: string;
    sceneIndex: number;
    revision: number;
    visualPrompt: string;
    promptDigest: string;
  }): Promise<LocalVisualLaunchPlan>;
  generate(plan: LocalVisualLaunchPlan): Promise<LocalVisualGeneratedImage>;
}

export type GenerateLocalVisualsInput = Readonly<{
  runId: string;
  sceneIndexes: readonly number[];
}> &
  VisualMutationExpectation;

/**
 * Generates one local revision per requested scene through an injected ready
 * local-model boundary.
 *
 * Calls are intentionally sequential: Apple-Silicon model memory is shared and
 * this layer must never launch competing inference work. The boundary may be a
 * test double, a local worker, or a future service adapter; this function makes
 * no claim that a model was downloaded or inferred by itself.
 */
export async function generateLocalVisuals(
  input: GenerateLocalVisualsInput,
  boundary: LocalVisualGenerationBoundary,
): Promise<VisualManifest> {
  await reconcileRunLedgerOutbox(input.runId);
  const requested = new Set(input.sceneIndexes);
  if (requested.size === 0) {
    throw new SafeExitError("Local visual generation requires at least one scene.");
  }

  const preparation = await loadLocalVisualPreparation(input, requested);
  const generated = [] as Array<{
    extension: "jpg" | "png";
    media: VisualRevision["media"];
    sceneIndex: number;
    revision: number;
    plan: LocalVisualLaunchPlan;
    image: LocalVisualGeneratedImage;
  }>;
  for (const scene of preparation.scenes) {
    const plan = localVisualLaunchPlanSchema.parse(
      await boundary.ensureReady({
        runId: input.runId,
        sceneIndex: scene.sceneIndex,
        revision: scene.revision,
        visualPrompt: scene.visualPrompt,
        promptDigest: scene.promptDigest,
      }),
    );
    assertLaunchPlanMatchesScene(plan, { ...scene, runId: input.runId });
    const image = localVisualGeneratedImageSchema.parse(await boundary.generate(plan));
    if (image.operationId !== plan.source.operationId) {
      throw new SafeExitError(
        `Local visual worker returned a different operation for scene ${scene.sceneIndex}.`,
      );
    }
    const media = await inspectVisualImage(image.bytes, plan.source.dimensions);
    generated.push({
      sceneIndex: scene.sceneIndex,
      revision: scene.revision,
      plan,
      image,
      media,
      extension: media.format === "jpeg" ? "jpg" : "png",
    });
  }

  const { value: manifest } = await mutateRun(input.runId, async (run, transaction) => {
    await requireVisualReviewState(run, "visuals-generate-local");
    const current = await loadVisualManifest(run);
    assertVisualMutationExpectation(current, input);
    const currentByScene = new Map(
      current.manifest.scenes.map((scene) => [scene.sceneIndex, scene]),
    );
    for (const item of generated) {
      const scene = currentByScene.get(item.sceneIndex);
      const expectedRevision = scene
        ? Math.max(...scene.revisions.map((revision) => revision.revision)) + 1
        : undefined;
      if (!scene || expectedRevision !== item.revision) {
        throw new SafeExitError(
          "Visual manifest changed; reload before retrying this local generation.",
        );
      }
    }
    const rollbackPaths = [
      ...visualMutationRollbackPaths,
      ...generated.map((item) =>
        visualRevisionPath(item.sceneIndex, item.revision, item.extension),
      ),
    ];
    transaction.onRollback(
      await captureVisualArtifactRollback(run.runId, "visuals-generate-local", rollbackPaths),
    );
    let updatedRun = run;
    const revisions = new Map<number, VisualRevision>();
    for (const item of generated) {
      const relativePath = visualRevisionPath(item.sceneIndex, item.revision, item.extension);
      updatedRun = await writeRunBinary(
        updatedRun,
        "visuals-generate-local",
        relativePath,
        item.image.bytes,
      );
      revisions.set(item.sceneIndex, {
        revision: item.revision,
        provider: "mflux-local",
        createdAt: nowIso(),
        asset: {
          role: "scene-visual",
          path: relativePath,
          digest: createHash("sha256").update(item.image.bytes).digest("hex"),
        },
        media: item.media,
        motion: deterministicVisualMotion(item.sceneIndex, item.revision),
        source: { ...item.plan.source, durationMs: item.image.durationMs },
      });
    }
    const nextManifest = visualManifestSchema.parse({
      ...current.manifest,
      updatedAt: nowIso(),
      scenes: current.manifest.scenes.map((scene) => {
        const revision = revisions.get(scene.sceneIndex);
        return revision
          ? {
              ...scene,
              activeRevision: revision.revision,
              revisions: [...scene.revisions, revision],
              decision: undefined,
            }
          : scene;
      }),
    });
    updatedRun = await invalidateVisualConsumers(updatedRun, "visuals-generate-local");
    updatedRun = await persistVisualManifest(updatedRun, nextManifest, "visuals-generate-local");
    updatedRun = queueRunLedgerEvent(updatedRun, {
      type: "ARTIFACT_REVISED",
      stage: "visuals-generate-local",
      message: `Generated ${generated.length} local visual revision(s) for review.`,
      data: {
        operationIds: generated.map((item) => item.plan.source.operationId),
        sceneIndexes: generated.map((item) => item.sceneIndex),
      },
    });
    return { run: updatedRun, value: nextManifest };
  });
  await reconcileRunLedgerOutbox(input.runId);
  return manifest;
}

async function loadLocalVisualPreparation(
  input: GenerateLocalVisualsInput,
  requested: Set<number>,
) {
  const run = await loadRun(input.runId);
  await requireVisualReviewState(run, "visuals-generate-local");
  const loaded = await loadVisualManifest(run);
  assertVisualMutationExpectation(loaded, input);
  const scenes = loaded.manifest.scenes
    .filter((scene) => requested.has(scene.sceneIndex))
    .map((scene) => ({
      sceneIndex: scene.sceneIndex,
      revision: Math.max(...scene.revisions.map((revision) => revision.revision)) + 1,
      visualPrompt: scene.visualPrompt,
      promptDigest: scene.promptDigest,
    }));
  if (scenes.length !== requested.size) {
    throw new SafeExitError("Local visual generation includes an unknown scene.");
  }
  return { scenes };
}

function assertLaunchPlanMatchesScene(
  plan: LocalVisualLaunchPlan,
  scene: {
    runId: string;
    sceneIndex: number;
    revision: number;
    visualPrompt: string;
    promptDigest: string;
  },
): void {
  if (
    plan.runId !== scene.runId ||
    plan.sceneIndex !== scene.sceneIndex ||
    plan.revision !== scene.revision ||
    plan.visualPrompt !== scene.visualPrompt ||
    plan.source.promptDigest !== scene.promptDigest
  ) {
    throw new SafeExitError(
      `Local visual readiness returned stale launch data for scene ${scene.sceneIndex}.`,
    );
  }
}
