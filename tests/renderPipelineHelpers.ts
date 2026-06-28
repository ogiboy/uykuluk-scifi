import { expect } from "vitest";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { createMinimalRenderAssets, enableDeterministicTts } from "./renderTestHelpers";

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
