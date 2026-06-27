import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readJsonFile } from "../src/utils/json";
import { uploadPrivatePlaceholder, publishSchedulePlaceholder } from "../src/stages/disabled";
import { approveIdea } from "../src/stages/approveIdea";
import { approveRender } from "../src/stages/approveRender";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { runReadiness } from "../src/stages/readiness";
import { formatReadinessConsole } from "../src/stages/readinessConsole";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { useTempProject } from "./helpers";
import { createMinimalRenderAssets, enableDeterministicTts } from "./renderTestHelpers";

describe("readiness and disabled public actions", () => {
  useTempProject();

  it("warns when brand assets are missing but passes core MVP", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await generateProductionPackage(runId);
    await estimateCost(runId);
    await generateEvidenceBundle(runId);
    const readiness = await runReadiness(runId);
    expect(readiness.passed).toBe(true);
    expect(readiness.checks.find((check) => check.name === "brand assets present")?.status).toBe(
      "warn",
    );
    expect(
      readiness.checks.find(
        (check) => check.name === "public upload disabled without explicit config",
      )?.status,
    ).toBe("pass");
    const state = await loadRun(runId);
    const diagnostics = await readJsonFile<{ currentState: string }>(
      artifactPath(runId, "diagnostics/readiness.json"),
    );
    expect(diagnostics.currentState).toBe(state.state);
  });

  it("blocks upload and publish by default", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await generateProductionPackage(runId);
    await estimateCost(runId);
    await generateEvidenceBundle(runId);
    await runReadiness(runId);

    await expect(uploadPrivatePlaceholder(runId)).rejects.toThrow(
      /requires explicit upload approval|Upload is disabled/,
    );
    await expect(publishSchedulePlaceholder(runId)).rejects.toThrow(
      /requires explicit publish approval|Publish is disabled/,
    );
  });

  it("blocks readiness when the persisted cost estimate is not allowed", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await generateProductionPackage(runId);
    await estimateCost(runId);
    await generateEvidenceBundle(runId);
    await writeFile(
      artifactPath(runId, "costs/estimate.json"),
      `${JSON.stringify(
        {
          nextStepAllowed: false,
          blockedReasons: ["Per-video budget exceeded: 2 > 1."],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const readiness = await runReadiness(runId);

    expect(readiness.passed).toBe(false);
    expect(readiness.checks.find((check) => check.name === "budget not exceeded")).toMatchObject({
      status: "block",
      message: expect.stringMatching(/could not be read|invalid/i),
    });
    expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
  });

  it("prints readiness next actions for missing operator artifacts", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await generateProductionPackage(runId);

    const output = formatReadinessConsole(runId, await runReadiness(runId));

    expect(output).toContain("Readiness blocked.");
    expect(output).toContain(`Next action: pnpm producer render-plan --run ${runId}`);
    expect(output).toContain(`Next action: pnpm producer estimate --run ${runId}`);
    expect(output).toContain(`Next action: pnpm producer evidence --run ${runId}`);
  });

  it("prints local production-loop next actions after readiness milestones", async () => {
    await enableDeterministicTts();
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

    const voiceOutput = formatReadinessConsole(runId, await runReadiness(runId));

    expect(voiceOutput).toContain(`Next action: pnpm producer voice --run ${runId}`);

    await generateVoiceoverAudio(runId);
    const approvalOutput = formatReadinessConsole(runId, await runReadiness(runId));

    expect(approvalOutput).toContain(`Next action: pnpm producer approve render --run ${runId}`);

    await approveRender(runId);
    const renderOutput = formatReadinessConsole(runId, await runReadiness(runId));

    expect(renderOutput).toContain(`Next action: pnpm producer render --run ${runId}`);
  });
});
