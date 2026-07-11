import { bulletList } from "../utils/markdown.js";
import type { AssetProvenance, RenderPlan } from "./renderPlanSchemas.js";

export type CountedValue = { count: number; value: string };

export type RenderPlanTimingReview = {
  averageSceneDurationSeconds: number;
  bookendDurationSeconds: number;
  estimatedDraftDurationSeconds: number;
  longestSceneDurationSeconds: number;
  sceneDurationSeconds: number;
  shortestSceneDurationSeconds: number;
};

export type RenderPlanSceneAssetReview = {
  backgroundAssetPath: string;
  durationSeconds: number;
  overlayAssetPaths: string[];
  sceneIndex: number;
};

export type RenderPlanBookendReview = {
  durationSeconds: number;
  frameAssetPaths: string[];
  segment: "intro" | "outro";
  sourceAssetPath: string;
};

export type RenderPlanReviewSummary = {
  assetRoleCounts: CountedValue[];
  backgroundReuse: CountedValue[];
  bookends: RenderPlanBookendReview[];
  reviewChecklist: string[];
  revisionGuidance: string[];
  sceneAssetMap: RenderPlanSceneAssetReview[];
  timing: RenderPlanTimingReview;
};

/**
 * Builds the operator-facing render-plan review summary.
 *
 * @param plan - The validated render plan.
 * @param provenance - The validated asset provenance record.
 * @returns A deterministic review summary for CLI and contact-sheet handoffs.
 */
export function summarizeRenderPlanReview(
  plan: RenderPlan,
  provenance: AssetProvenance,
): RenderPlanReviewSummary {
  const timing = summarizeTiming(plan);
  const backgroundReuse = countValues(plan.scenes.map((scene) => scene.backgroundAsset.path));
  return {
    assetRoleCounts: countValues(provenance.assets.map((asset) => asset.role)),
    backgroundReuse,
    bookends: buildBookendReview(plan),
    reviewChecklist: renderPlanReviewChecklist(plan, timing, backgroundReuse),
    revisionGuidance: renderPlanRevisionGuidance(backgroundReuse),
    sceneAssetMap: buildSceneAssetMap(plan),
    timing,
  };
}

/**
 * Builds a compact scene-to-asset map for operator review handoffs.
 *
 * @param plan - The validated render plan.
 * @returns One row per render-plan scene with the selected visual assets.
 */
function buildSceneAssetMap(plan: RenderPlan): RenderPlanSceneAssetReview[] {
  return plan.scenes.map((scene) => ({
    backgroundAssetPath: scene.backgroundAsset.path,
    durationSeconds: scene.durationSeconds,
    overlayAssetPaths: scene.overlayAssets.map((asset) => asset.path),
    sceneIndex: scene.sceneIndex,
  }));
}

/**
 * Builds a compact bookend source summary for operator review handoffs.
 *
 * @param plan - The validated render plan.
 * @returns Intro/outro source assets and committed frame sequences, when present.
 */
function buildBookendReview(plan: RenderPlan): RenderPlanBookendReview[] {
  if (!plan.bookends) {
    return [];
  }
  return [
    {
      durationSeconds: plan.bookends.intro.durationSeconds,
      frameAssetPaths: (plan.bookends.intro.frameAssets ?? []).map((asset) => asset.path),
      segment: "intro",
      sourceAssetPath: plan.bookends.intro.asset.path,
    },
    {
      durationSeconds: plan.bookends.outro.durationSeconds,
      frameAssetPaths: (plan.bookends.outro.frameAssets ?? []).map((asset) => asset.path),
      segment: "outro",
      sourceAssetPath: plan.bookends.outro.asset.path,
    },
  ];
}

/**
 * Renders the visual rhythm summary included in the storyboard contact sheet.
 *
 * @param summary - The computed review summary.
 * @returns Markdown lines for the visual rhythm review section.
 */
export function renderVisualRhythmReview(summary: RenderPlanReviewSummary): string[] {
  return [
    "## Visual Rhythm Review",
    "",
    `- Scene duration range: ${formatSeconds(summary.timing.shortestSceneDurationSeconds)}-${formatSeconds(summary.timing.longestSceneDurationSeconds)}`,
    `- Average scene duration: ${formatSeconds(summary.timing.averageSceneDurationSeconds)}`,
    `- Background reuse: ${formatCountedValues(summary.backgroundReuse, "none")}`,
    `- Asset role counts: ${formatCountedValues(summary.assetRoleCounts, "none")}`,
    "",
    "Review checklist:",
    "",
    bulletList(summary.reviewChecklist),
    "",
    "Revision guidance:",
    "",
    bulletList(summary.revisionGuidance),
    "",
  ];
}

function summarizeTiming(plan: RenderPlan): RenderPlanTimingReview {
  const durations = plan.scenes.map((scene) => scene.durationSeconds);
  const sceneDurationSeconds = durations.reduce((total, duration) => total + duration, 0);
  const bookendDurationSeconds = plan.bookends
    ? plan.bookends.intro.durationSeconds + plan.bookends.outro.durationSeconds
    : 0;
  return {
    averageSceneDurationSeconds: durations.length > 0 ? sceneDurationSeconds / durations.length : 0,
    bookendDurationSeconds,
    estimatedDraftDurationSeconds: sceneDurationSeconds + bookendDurationSeconds,
    longestSceneDurationSeconds: durations.length > 0 ? Math.max(...durations) : 0,
    sceneDurationSeconds,
    shortestSceneDurationSeconds: durations.length > 0 ? Math.min(...durations) : 0,
  };
}

function renderPlanReviewChecklist(
  plan: RenderPlan,
  timing: RenderPlanTimingReview,
  backgroundReuse: CountedValue[],
): string[] {
  return [
    `Review ${plan.scenes.length} scene cards against the approved package before voiceover.`,
    `Confirm the scene timing range ${formatSeconds(timing.shortestSceneDurationSeconds)}-${formatSeconds(timing.longestSceneDurationSeconds)} supports a coherent narrated rhythm.`,
    backgroundReuse.length > 0
      ? "Confirm repeated background plates are intentional and not visually stale."
      : "Confirm the selected background plates stay visually consistent across the episode.",
    "Confirm subtitle panel, popup card, waveform, and watermark roles are present before render approval.",
    "Confirm this review is evidence only; it does not approve voiceover, render, upload, or publish.",
  ];
}

function renderPlanRevisionGuidance(backgroundReuse: CountedValue[]): string[] {
  const visualRevision =
    backgroundReuse.length > 0
      ? "If repeated backgrounds look monotonous, add or reassign tracked background plates and regenerate the render plan."
      : "If the visual rhythm feels weak, revise scene prompts, subtitles, popup cards, or tracked assets and regenerate the render plan.";
  return [
    visualRevision,
    "If timing feels rushed or padded, revise the production package scenes and regenerate the render plan.",
    "Do not approve render from this handoff; current voiceover evidence and exact render approval remain separate gates.",
  ];
}

function countValues(values: string[]): CountedValue[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ count, value })).sort((left, right) =>
    left.value.localeCompare(right.value),
  );
}

function formatCountedValues(values: CountedValue[], empty: string): string {
  if (values.length === 0) {
    return empty;
  }
  return values.map((item) => `${item.value}=${item.count}`).join(", ");
}

function formatSeconds(value: number): string {
  return `${Math.round(value)}s`;
}
