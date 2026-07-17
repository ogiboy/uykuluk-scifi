import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { estimateCost } from "../src/stages/estimate";
import {
  decideVisuals,
  generateHostedVisuals,
  prepareHostedVisualGenerationPlan,
} from "../src/stages/visuals";
import { readHostedVisualGenerationRevision } from "../src/stages/visuals/visualGenerationRevision";
import { useTempProject } from "./helpers";
import {
  currentHostedVisualPlan,
  exactCostApproval,
  hostedSceneExecutor,
  prepareApprovedHostedVisualRun,
} from "./hostedVisualWorkflowTestHelpers";
import { currentVisualExpectation } from "./visualTestHelpers";

describe("sequential hosted visual regeneration", () => {
  useTempProject();

  it("keeps later partial revisions readable when selected scenes come from older batches", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const firstQuote = await readCostEstimate(runId);
    const firstPlan = await currentHostedVisualPlan(runId);
    const firstApproval = exactCostApproval(await loadRun(runId), firstQuote.digest);
    await executePlan(runId, firstPlan, firstQuote.digest, firstApproval.approvalId, "first");

    await rejectScene(runId, 1, "Regenerate scene one first.");
    await planRegeneration(runId, 1, "First partial regeneration.");
    await estimateCost(runId);
    const secondQuote = await readCostEstimate(runId);
    const secondApproval = await approvePaidGenerationCost(runId);
    const secondPlan = await currentHostedVisualPlan(runId);
    await executePlan(runId, secondPlan, secondQuote.digest, secondApproval.approvalId, "second");

    await rejectScene(runId, 2, "Scene two still uses the original settled batch.");
    await planRegeneration(runId, 2, "Second partial regeneration from the original batch.");

    const run = await loadRun(runId);
    const revisionIds = run.artifacts
      .filter((item) => /^revisions\/hosted-visual\/[^/]+\/revision\.json$/.test(item))
      .map((item) => item.split("/")[2]!);
    expect(revisionIds).toHaveLength(2);
    const revisions = await Promise.all(
      revisionIds.map((revisionId) => readHostedVisualGenerationRevision(runId, revisionId)),
    );
    expect(revisions[1]).toMatchObject({
      previousPlan: { digest: secondPlan.digest },
      rejectedSceneIndexes: [2],
      selectedSources: [{ sceneIndex: 2, source: { planDigest: firstPlan.digest } }],
    });
    const secondRevision = revisions[1]!;
    const secondRevisionPath = artifactPath(
      runId,
      `revisions/hosted-visual/${revisionIds[1]!}/revision.json`,
    );
    await writeFile(
      secondRevisionPath,
      `${JSON.stringify({
        ...secondRevision,
        selectedSources: [
          {
            ...secondRevision.selectedSources[0],
            source: { ...secondRevision.selectedSources[0]!.source, planDigest: "f".repeat(64) },
          },
        ],
      })}\n`,
      "utf8",
    );
    await expect(readHostedVisualGenerationRevision(runId, revisionIds[1]!)).rejects.toThrow(
      /historical source/i,
    );
  });
});

async function executePlan(
  runId: string,
  plan: Awaited<ReturnType<typeof currentHostedVisualPlan>>,
  quoteDigest: string,
  approvalId: string,
  batch: string,
): Promise<void> {
  await generateHostedVisuals({
    runId,
    confirmation: {
      approvalId,
      bindingDigest: plan.digest,
      quoteDigest,
      confirmPaidOperation: true,
    },
    dependencies: {
      readApiKey: () => "test-bfl-key",
      executeScene: hostedSceneExecutor(batch) as never,
    },
  });
}

async function rejectScene(runId: string, sceneIndex: number, notes: string): Promise<void> {
  await decideVisuals({
    ...(await currentVisualExpectation(runId)),
    runId,
    sceneIndexes: [sceneIndex],
    status: "rejected",
    reviewedBy: "visual director",
    notes,
  });
}

async function planRegeneration(runId: string, sceneIndex: number, reason: string): Promise<void> {
  await prepareHostedVisualGenerationPlan({
    ...(await currentVisualExpectation(runId)),
    runId,
    purpose: "regenerate-rejected",
    sceneIndexes: [sceneIndex],
    reviewedBy: "visual director",
    reason,
  });
}
