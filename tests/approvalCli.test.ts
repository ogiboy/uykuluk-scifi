import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { loadRun } from "../src/core/runStore";
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
import { useTempProject } from "./helpers";
import { createMinimalRenderAssets, enableDeterministicTts } from "./renderTestHelpers";

const repoRoot = process.cwd();

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
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
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
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  const readiness = await runReadiness(runId);
  expect(readiness.passed).toBe(true);
  await generateVoiceoverAudio(runId);
  return runId;
}
