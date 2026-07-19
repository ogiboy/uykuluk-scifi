import { expect } from "vitest";
import { approveIdea } from "../src/stages/approveIdea";
import { approveRender } from "../src/stages/approveRender";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { renderDraft } from "../src/stages/render";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import {
  analyzeSoundtrackLoudness,
  decideSoundtrack,
  prepareVoiceOnlySoundtrack,
} from "../src/stages/soundtrack";
import { generateVoiceoverAudio } from "../src/stages/voice";
import {
  createFakeFfmpeg,
  createFakeFfprobe,
  createMinimalRenderAssets,
  enableDeterministicTts,
  renderToolRoot,
} from "./renderTestHelpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";

/**
 * Prepares a run that has all manual-production prerequisites plus deterministic voiceover audio.
 *
 * @returns The prepared run id.
 */
export async function prepareVoiceoverReadyRun(): Promise<string> {
  const runId = await prepareReadyRunWithoutVoiceover();
  await generateVoiceoverAudio(runId);
  await prepareApprovedVoiceOnlySoundtrack(runId);
  return runId;
}

/** Persists analyzed and operator-approved voice-only soundtrack evidence for render tests. */
export async function prepareApprovedVoiceOnlySoundtrack(runId: string): Promise<void> {
  const prepared = await prepareVoiceOnlySoundtrack({ runId });
  const analyzed = await analyzeSoundtrackLoudness({
    runId,
    expectedManifestDigest: prepared.digest,
    expectedRevision: prepared.manifest.revision,
    ffmpeg: async () => ({
      stderr: JSON.stringify({
        input_i: "-14.2",
        input_tp: "-1.6",
        input_lra: "5.1",
        input_thresh: "-24.2",
        target_offset: "0.2",
      }),
    }),
  });
  await decideSoundtrack({
    runId,
    expectedManifestDigest: analyzed.digest,
    expectedRevision: analyzed.manifest.revision,
    status: "approved",
    reviewedBy: "Render test operator",
    notes: "Voice-only fallback loudness analysis accepted for deterministic render testing.",
  });
}

/**
 * Prepares a voiceover-ready run, approves render, and writes a fake local draft render.
 *
 * @param scope - The isolated fake media-tool scope.
 * @returns The rendered run id.
 */
export async function renderLocalDraft(scope: string): Promise<string> {
  const runId = await prepareVoiceoverReadyRun();
  await approveRender(runId);
  await renderDraft(runId, {
    ffmpegBinary: await createFakeFfmpeg(renderToolRoot(scope)),
    ffprobeBinary: await createFakeFfprobe(renderToolRoot(scope)),
    maxDurationSeconds: 8,
  });
  return runId;
}

/**
 * Prepares a run that has render plan, evidence, cost estimate, and readiness but no voiceover.
 *
 * @returns The prepared run id.
 */
export async function prepareReadyRunWithoutVoiceover(): Promise<string> {
  await enableDeterministicTts(process.cwd());
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await prepareApprovedStaticVisuals(runId);
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  return runId;
}
