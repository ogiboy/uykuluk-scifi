import { describe, expect, it } from "vitest";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";
import { prepareApprovedVoiceOnlySoundtrack } from "./renderPipelineHelpers";
import { createMinimalRenderAssets, enableDeterministicTts } from "./renderTestHelpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";

describe("producer approval CLI", () => {
  useTempProject();

  it("prints parseable JSON idea approvals for automation", async () => {
    const { runId, ideas } = await runIdeas();
    const idea = ideas[0];

    const result = runCli(["approve", "idea", "--run", runId, "--idea", idea.id, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      runId,
      target: "idea",
      approvedRef: idea.id,
      previousState: "IDEAS_GENERATED",
      nextState: "IDEA_APPROVED",
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "IDEA_APPROVED" });
  });

  it("prints parseable JSON script approvals for automation", async () => {
    const runId = await prepareReviewedScriptRun();

    const result = runCli([
      "approve",
      "script",
      "--run",
      runId,
      "--acknowledge-warnings",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      runId,
      target: "script",
      approvedRef: expect.stringMatching(/^[a-f0-9]{64}$/),
      previousState: "SCRIPT_REVIEWED",
      nextState: "SCRIPT_APPROVED",
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "SCRIPT_APPROVED" });
  });

  it("prints parseable JSON render approvals for automation", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const result = runCli(["approve", "render", "--run", runId, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      runId,
      target: "render",
      approvedRef: expect.stringMatching(/^[a-f0-9]{64}$/),
      previousState: "READY_FOR_MANUAL_PRODUCTION",
      nextState: "RENDER_APPROVED",
    });
    await expect(loadRun(runId)).resolves.toMatchObject({ state: "RENDER_APPROVED" });
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}

async function prepareReviewedScriptRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  return runId;
}

async function prepareVoiceoverReadyRun(): Promise<string> {
  await enableDeterministicTts(process.cwd());
  await createMinimalRenderAssets();
  const runId = await prepareReviewedScriptRun();
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await prepareApprovedStaticVisuals(runId);
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  await generateVoiceoverAudio(runId);
  await prepareApprovedVoiceOnlySoundtrack(runId);
  return runId;
}
