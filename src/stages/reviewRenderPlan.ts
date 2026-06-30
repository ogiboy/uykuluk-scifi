import { readFile } from "node:fs/promises";
import { artifactPath } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { loadRun } from "../core/runStore.js";
import { readJsonFile } from "../utils/json.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import {
  assetProvenanceSchema,
  renderPlanArtifactPaths,
  renderPlanSchema,
  type RenderPlan,
} from "./renderPlanSchemas.js";
import {
  summarizeRenderPlanReview,
  type RenderPlanBookendReview,
  type CountedValue,
  type RenderPlanSceneAssetReview,
  type RenderPlanTimingReview,
} from "./renderPlanReviewSummary.js";

const [renderPlanPath, contactSheetPath, assetProvenancePath] = renderPlanArtifactPaths;

export type RenderPlanReviewHandoff = {
  assetCount: number;
  assetRoleCounts: CountedValue[];
  assetProvenancePath: string;
  backgroundReuse: CountedValue[];
  blockedActions: string[];
  bookends: RenderPlanBookendReview[];
  contactSheetPath: string;
  estimatedDraftDurationSeconds: number;
  format: RenderPlan["format"];
  nextSafeAction: string;
  productionPackageManifestDigest: string;
  productionPackageManifestPath: string;
  renderPlanPath: string;
  reviewChecklist: string[];
  runId: string;
  sceneCount: number;
  sceneAssetMap: RenderPlanSceneAssetReview[];
  timing: RenderPlanTimingReview;
  revisionGuidance: string[];
};

/**
 * Reads the validated render-plan review handoff for a run.
 *
 * @param runId - The run whose render plan should be reviewed.
 * @returns The operator-facing render-plan review handoff.
 */
export async function reviewRenderPlan(runId: string): Promise<RenderPlanReviewHandoff> {
  const run = await loadRun(runId);
  const evidence = await readRenderPlanEvidence(run);
  if (evidence.status === "missing") {
    throw new SafeExitError(
      `Render-plan review requires generated artifacts. Run pnpm producer render-plan --run ${run.runId}`,
    );
  }
  if (evidence.status === "block") {
    throw new SafeExitError(`Render-plan review requires valid evidence: ${evidence.message}`);
  }
  const plan = renderPlanSchema.parse(await readJsonFile(artifactPath(run.runId, renderPlanPath)));
  const provenance = assetProvenanceSchema.parse(
    await readJsonFile(artifactPath(run.runId, assetProvenancePath)),
  );
  await readFile(artifactPath(run.runId, contactSheetPath), "utf8");
  const reviewSummary = summarizeRenderPlanReview(plan, provenance);
  return {
    assetCount: provenance.assets.length,
    assetRoleCounts: reviewSummary.assetRoleCounts,
    assetProvenancePath,
    backgroundReuse: reviewSummary.backgroundReuse,
    blockedActions: renderPlanReviewBlockedActions(),
    bookends: reviewSummary.bookends,
    contactSheetPath,
    estimatedDraftDurationSeconds: reviewSummary.timing.estimatedDraftDurationSeconds,
    format: plan.format,
    nextSafeAction: renderPlanReviewNextAction(run.runId),
    productionPackageManifestDigest: plan.productionPackageManifestDigest,
    productionPackageManifestPath: plan.productionPackageManifestPath,
    renderPlanPath,
    reviewChecklist: reviewSummary.reviewChecklist,
    revisionGuidance: reviewSummary.revisionGuidance,
    runId: run.runId,
    sceneCount: plan.scenes.length,
    sceneAssetMap: reviewSummary.sceneAssetMap,
    timing: reviewSummary.timing,
  };
}

/**
 * Formats the render-plan review handoff for console output.
 *
 * @param handoff - The review handoff to format.
 * @returns Operator-readable console text.
 */
export function formatRenderPlanReviewConsole(handoff: RenderPlanReviewHandoff): string {
  return [
    `Run: ${handoff.runId}`,
    `Render plan: ${handoff.renderPlanPath}`,
    `Contact sheet: ${handoff.contactSheetPath}`,
    `Asset provenance: ${handoff.assetProvenancePath}`,
    `Scenes: ${handoff.sceneCount}`,
    `Assets: ${handoff.assetCount}`,
    `Estimated local draft duration: ${Math.round(handoff.estimatedDraftDurationSeconds)}s`,
    `Scene duration range: ${Math.round(handoff.timing.shortestSceneDurationSeconds)}s-${Math.round(handoff.timing.longestSceneDurationSeconds)}s`,
    `Background reuse: ${formatCountedValues(handoff.backgroundReuse, "none")}`,
    `Asset role counts: ${formatCountedValues(handoff.assetRoleCounts, "none")}`,
    "Bookends:",
    ...formatBookendReviewLines(handoff.bookends),
    "Scene asset map:",
    ...handoff.sceneAssetMap.map(formatSceneAssetMapLine),
    `Format: ${handoff.format.resolution}, ${handoff.format.fps}fps, ${handoff.format.aspectRatio}, ${handoff.format.draftRenderer}`,
    `Package manifest: ${handoff.productionPackageManifestPath}`,
    `Package manifest digest: ${handoff.productionPackageManifestDigest}`,
    `Next safe action: ${handoff.nextSafeAction}`,
    "Review checklist:",
    ...handoff.reviewChecklist.map((item) => `- ${item}`),
    "Revision guidance:",
    ...handoff.revisionGuidance.map((item) => `- ${item}`),
    "Still blocked:",
    ...handoff.blockedActions.map((action) => `- ${action}`),
  ].join("\n");
}

function renderPlanReviewNextAction(runId: string): string {
  return `Review ${contactSheetPath}; if acceptable, run pnpm producer estimate --run ${runId}, then pnpm producer evidence --run ${runId} and pnpm producer readiness --run ${runId} before local voiceover.`;
}

function renderPlanReviewBlockedActions(): string[] {
  return [
    "Voiceover generation still requires explicit local TTS configuration plus current evidence/readiness.",
    "Local draft render still requires voiceover evidence and explicit render approval.",
    "Private upload, scheduled publish, public publish, and paid/generative media providers remain disabled.",
  ];
}

function formatCountedValues(values: CountedValue[], empty: string): string {
  if (values.length === 0) {
    return empty;
  }
  return values.map((item) => `${item.value}=${item.count}`).join(", ");
}

function formatSceneAssetMapLine(scene: RenderPlanSceneAssetReview): string {
  const overlays = scene.overlayAssetPaths.length > 0 ? scene.overlayAssetPaths.join(", ") : "none";
  return `- Scene ${scene.sceneIndex}: ${Math.round(scene.durationSeconds)}s, background ${scene.backgroundAssetPath}, overlays ${overlays}`;
}

function formatBookendReviewLines(bookends: RenderPlanBookendReview[]): string[] {
  if (bookends.length === 0) {
    return ["- none"];
  }
  return bookends.map((bookend) => {
    const frames =
      bookend.frameAssetPaths.length > 0
        ? `${bookend.frameAssetPaths.length} committed frames: ${bookend.frameAssetPaths.join(", ")}`
        : "no committed frame sequence";
    return `- ${bookend.segment}: ${Math.round(bookend.durationSeconds)}s, source ${bookend.sourceAssetPath}, ${frames}`;
  });
}
