import { bulletList, table } from "../utils/markdown.js";
import { renderOperatorDecisionSection } from "./operatorReviewMarkdown.js";
import { AssetProvenance, AssetRef, RenderPlan } from "./renderPlanSchemas.js";
import {
  renderVisualRhythmReview,
  summarizeRenderPlanReview,
  type RenderPlanSceneAssetReview,
} from "./renderPlanReviewSummary.js";

/**
 * Builds a Markdown contact sheet for a storyboard render plan.
 *
 * @param plan - The render plan to summarize.
 * @param provenance - The asset provenance data to include.
 * @returns A Markdown string containing the contact sheet.
 */
export function renderContactSheet(plan: RenderPlan, provenance: AssetProvenance): string {
  const reviewSummary = summarizeRenderPlanReview(plan, provenance);
  return [
    "# Storyboard Contact Sheet",
    "",
    `Run: ${plan.runId}`,
    `Generated at: ${plan.createdAt}`,
    "",
    "> Review artifact only. This does not approve render execution, TTS, upload, or publish.",
    "",
    "## Render Plan Inputs",
    "",
    `- Production package manifest: ${plan.productionPackageManifestPath}`,
    `- Manifest digest: ${plan.productionPackageManifestDigest}`,
    `- Asset count: ${provenance.assets.length}`,
    "",
    ...renderTimingSummary(plan),
    ...renderVisualRhythmReview(reviewSummary),
    ...renderSceneAssetMap(reviewSummary.sceneAssetMap),
    ...renderBookends(plan),
    "## Asset Provenance",
    "",
    bulletList(
      provenance.assets.map(
        (asset) => `${asset.role}: ${asset.path} (${asset.digest.slice(0, 12)})`,
      ),
    ),
    "",
    ...renderContactSheetDecision(plan.runId),
    "## Scenes",
    "",
    ...plan.scenes.map((scene) =>
      [
        `### Scene ${scene.sceneIndex}`,
        "",
        `- Duration: ${scene.durationSeconds}s`,
        `- Background: ${scene.backgroundAsset.path}`,
        `- Overlays: ${scene.overlayAssets.map((asset) => asset.path).join(", ")}`,
        `- Subtitle source: ${scene.subtitleSource}`,
        "",
        scene.visualPrompt,
        "",
        `Narration preview: ${scene.narrationPreview}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");
}

/**
 * Renders a compact scene-to-asset map before the detailed scene cards.
 *
 * @param sceneAssetMap - The scene asset rows computed from the render plan.
 * @returns Markdown lines for the compact map.
 */
function renderSceneAssetMap(sceneAssetMap: RenderPlanSceneAssetReview[]): string[] {
  return [
    "## Scene Asset Map",
    "",
    table(
      ["Scene", "Duration", "Background", "Overlays"],
      sceneAssetMap.map((scene) => [
        String(scene.sceneIndex),
        formatSeconds(scene.durationSeconds),
        scene.backgroundAssetPath,
        formatOverlayAssetPaths(scene.overlayAssetPaths),
      ]),
    ),
    "",
  ];
}

/**
 * Renders the timing summary operators use before voiceover and draft render work.
 *
 * @param plan - The render plan to summarize.
 * @returns Markdown lines describing scene, bookend, and estimated local draft duration.
 */
function renderTimingSummary(plan: RenderPlan): string[] {
  const sceneDurationSeconds = plan.scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );
  const bookendDurationSeconds = plan.bookends
    ? plan.bookends.intro.durationSeconds + plan.bookends.outro.durationSeconds
    : 0;
  return [
    "## Timing Summary",
    "",
    `- Scene count: ${plan.scenes.length}`,
    `- Scene narration duration: ${formatSeconds(sceneDurationSeconds)}`,
    `- Intro/outro bookends: ${formatSeconds(bookendDurationSeconds)}`,
    `- Estimated local draft duration: ${formatSeconds(sceneDurationSeconds + bookendDurationSeconds)}`,
    "",
    "> Timing is planning evidence only. Voiceover generation and render approval remain separate gates.",
    "",
  ];
}

/**
 * Builds the operator decision section for the contact sheet.
 *
 * @param runId - The render run identifier used in the follow-up commands.
 * @returns The markdown lines for the decision section.
 */
function renderContactSheetDecision(runId: string): string[] {
  return renderOperatorDecisionSection({
    reviewGates: [
      "Confirm scene-to-asset mapping matches the approved package and channel visual style.",
      "Confirm intro/outro bookends, subtitle panel, popup card, watermark, and waveform roles are suitable for a local draft.",
      "Confirm this contact sheet is review evidence only; file existence does not approve TTS, render, upload, or publish.",
    ],
    acceptableNextSteps: [
      `Run \`pnpm producer estimate --run ${runId}\` if the current package still needs a cost estimate.`,
      `Run \`pnpm producer evidence --run ${runId}\` and \`pnpm producer readiness --run ${runId}\` before local voiceover generation.`,
      `Run \`pnpm producer voice --run ${runId}\` only after readiness passes and local TTS is explicitly enabled.`,
    ],
    revisionSteps: [
      "Revise the production package, subtitles, popup cards, or tracked assets, then regenerate the render plan.",
      "Do not advance to voiceover or render approval from an unacceptable contact sheet.",
    ],
    blockedActions: [
      "Local draft render still requires voiceover evidence and explicit render approval.",
      "Private upload, scheduled publish, public publish, and paid/generative media providers remain unavailable in this artifact.",
    ],
  });
}

/**
 * Renders the intro and outro bookend section for a contact sheet.
 *
 * @param plan - The render plan that may include bookend assets.
 * @returns An array of Markdown lines for the bookend section, or an empty array when no bookends are present.
 */
function renderBookends(plan: RenderPlan): string[] {
  if (!plan.bookends) {
    return [];
  }
  return [
    "## Intro And Outro Bookends",
    "",
    `- Intro: ${plan.bookends.intro.asset.path} for ${plan.bookends.intro.durationSeconds}s`,
    ...frameBullets("Intro source frames", plan.bookends.intro.frameAssets),
    `- Outro: ${plan.bookends.outro.asset.path} for ${plan.bookends.outro.durationSeconds}s`,
    ...frameBullets("Outro source frames", plan.bookends.outro.frameAssets),
    "",
    "> These committed source assets are included in the local draft render timeline for review; they do not imply upload or publish approval.",
    "",
  ];
}

/**
 * Builds a bullet for the number of committed frames in a bookend asset set.
 *
 * @param label - The frame set label to include in the bullet text
 * @param frames - The frames to count
 * @returns A single bullet describing the frame count, or an empty array when no frames are provided
 */
function frameBullets(label: string, frames: AssetRef[] | undefined): string[] {
  if (!frames || frames.length === 0) {
    return [];
  }
  return [`- ${label}: ${frames.length} committed frames`];
}

function formatSeconds(value: number): string {
  return `${Math.round(value)}s`;
}

function formatOverlayAssetPaths(paths: string[]): string {
  return paths.length > 0 ? paths.join(", ") : "none";
}
