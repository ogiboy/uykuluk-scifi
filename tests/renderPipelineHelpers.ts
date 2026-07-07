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
import { generateVoiceoverAudio } from "../src/stages/voice";
import {
  createFakeFfmpeg,
  createFakeFfprobe,
  createMinimalRenderAssets,
  enableDeterministicTts,
  renderToolRoot,
} from "./renderTestHelpers";

/**
 * Prepares a run that has all manual-production prerequisites plus deterministic voiceover audio.
 *
 * @returns The prepared run id.
 */
export async function prepareVoiceoverReadyRun(): Promise<string> {
  const runId = await prepareReadyRunWithoutVoiceover();
  await generateVoiceoverAudio(runId);
  return runId;
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
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  return runId;
}
