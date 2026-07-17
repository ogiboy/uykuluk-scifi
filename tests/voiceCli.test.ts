import { describe, expect, it } from "vitest";
import { voiceExecutionConfirmationFromOptions } from "../src/cli/voiceExecutionConfirmationOptions";
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
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";
import { createMinimalRenderAssets, enableDeterministicTts } from "./renderTestHelpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";

describe("producer voice CLI", () => {
  useTempProject();

  it("prints parseable JSON voiceover metadata for automation", async () => {
    await enableDeterministicTts(process.cwd());
    const runId = await prepareReadyRun();

    const result = runCli(["voice", "--run", runId, "--json"]);

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      schemaVersion: 2,
      runId,
      mode: "deterministic-local",
      quality: "deterministic-local-reference",
      output: {
        path: "production/audio/voiceover.wav",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      renderPlan: {
        path: "production/render_plan.json",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      source: { path: "production/voiceover.txt", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    await expect(loadRun(runId)).resolves.toMatchObject({
      artifacts: expect.arrayContaining(["production/audio/voiceover.meta.json"]),
      state: "READY_FOR_MANUAL_PRODUCTION",
    });
  });

  it("requires every hosted execution flag together", () => {
    const result = runCli([
      "voice",
      "--run",
      "run_voice_cli_flags",
      "--binding-digest",
      "a".repeat(64),
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/requires --binding-digest.*--quote-digest.*--approval-id/i);
  });

  it("distinguishes malformed hosted confirmation values from missing flags", () => {
    expect(() =>
      voiceExecutionConfirmationFromOptions({
        approvalId: "approval_voice_cli",
        bindingDigest: "not-a-digest",
        confirmPaidOperation: true,
        quoteDigest: "b".repeat(64),
      }),
    ).toThrow(/confirmation values are invalid/i);
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}

async function prepareReadyRun(): Promise<string> {
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
