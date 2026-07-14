import sharp from "sharp";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { decideVisuals, prepareStaticVisuals } from "../src/stages/visuals";
import { loadVisualManifest } from "../src/stages/visuals/visualManifest";
import { createMinimalRenderAssets } from "./renderTestHelpers";

/** Prepares a packaged run and the committed static asset fallback. */
export async function preparePackagedVisualRun(): Promise<string> {
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}

/** Creates and approves static visual revisions for every scene in a packaged run. */
export async function prepareApprovedStaticVisuals(runId: string): Promise<void> {
  const manifest = await prepareStaticVisuals(runId);
  await decideVisuals({
    runId,
    sceneIndexes: manifest.scenes.map((scene) => scene.sceneIndex),
    status: "approved",
    reviewedBy: "test-operator",
    notes: "Static fallback accepted for deterministic test coverage.",
    ...(await currentVisualExpectation(runId)),
  });
}

export async function currentVisualExpectation(runId: string) {
  const loaded = await loadVisualManifest(await loadRun(runId));
  return {
    expectedManifestDigest: loaded.digest,
    expectedActiveRevisions: loaded.manifest.scenes.map((scene) => ({
      sceneIndex: scene.sceneIndex,
      activeRevision: scene.activeRevision,
    })),
  };
}

/** Writes a valid production-sized PNG for import-contract tests. */
export async function writeTestPng(target: string, width = 1920, height = 1080): Promise<void> {
  await sharp({ create: { width, height, channels: 3, background: { r: 12, g: 24, b: 48 } } })
    .png()
    .toFile(target);
}
