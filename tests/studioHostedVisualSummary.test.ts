import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { readStudioVisualSummary } from "../apps/studio/src/lib/runs/visualSummaries";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import {
  decideVisuals,
  generateHostedVisuals,
  prepareHostedVisualGenerationPlan,
} from "../src/stages/visuals";
import { loadVisualManifest } from "../src/stages/visuals/visualManifest";
import { useTempProject } from "./helpers";
import {
  currentHostedVisualPlan,
  exactCostApproval,
  hostedSceneExecutor,
  prepareApprovedHostedVisualRun,
} from "./hostedVisualWorkflowTestHelpers";
import { currentVisualExpectation } from "./visualTestHelpers";

describe("Studio hosted visual summary", () => {
  useTempProject();

  it("offers rejected-scene regeneration after settlement and disables replanning once committed", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const quote = await readCostEstimate(runId);
    const plan = await currentHostedVisualPlan(runId);
    const approval = exactCostApproval(await loadRun(runId), quote.digest);
    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: approval.approvalId,
        bindingDigest: plan.digest,
        quoteDigest: quote.digest,
        confirmPaidOperation: true,
      },
      dependencies: {
        readApiKey: () => "test-bfl-key",
        executeScene: hostedSceneExecutor("studio") as never,
      },
    });
    await decideVisuals({
      ...(await currentVisualExpectation(runId)),
      runId,
      sceneIndexes: [1],
      status: "rejected",
      reviewedBy: "visual director",
      notes: "Scene one needs another hosted revision.",
    });

    const settled = await readStudioVisualSummary(process.cwd(), runId);
    expect(settled.hosted).toMatchObject({
      allowedPlanPurpose: "regenerate-rejected",
      eligibleRejectedSceneIndexes: [1],
      plan: { digest: plan.digest, purpose: "initial", status: "settled" },
    });
    expect(settled.actions["visuals.plan-hosted"]).toBeTruthy();
    expect(settled.actions["visuals.generate-hosted"]).toBeNull();

    await prepareHostedVisualGenerationPlan({
      ...(await currentVisualExpectation(runId)),
      runId,
      purpose: "regenerate-rejected",
      sceneIndexes: [1],
      reviewedBy: "visual director",
      reason: "Replace the rejected scene.",
    });
    const replacement = await readStudioVisualSummary(process.cwd(), runId);
    expect(replacement.hosted).toMatchObject({
      allowedPlanPurpose: null,
      plan: { purpose: "regenerate-rejected", status: "ready" },
    });
    expect(replacement.actions["visuals.plan-hosted"]).toBeNull();
  });

  it("does not offer hosted regeneration for a rejected static scene", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const quote = await readCostEstimate(runId);
    const plan = await currentHostedVisualPlan(runId);
    const approval = exactCostApproval(await loadRun(runId), quote.digest);
    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: approval.approvalId,
        bindingDigest: plan.digest,
        quoteDigest: quote.digest,
        confirmPaidOperation: true,
      },
      dependencies: {
        readApiKey: () => "test-bfl-key",
        executeScene: hostedSceneExecutor("static-rejection") as never,
      },
    });
    await decideVisuals({
      ...(await currentVisualExpectation(runId)),
      runId,
      sceneIndexes: [3],
      status: "rejected",
      reviewedBy: "visual director",
      notes: "This untouched scene still uses the static fallback.",
    });

    const summary = await readStudioVisualSummary(process.cwd(), runId);
    expect(summary.hosted).toMatchObject({
      allowedPlanPurpose: null,
      eligibleRejectedSceneIndexes: [],
      plan: { status: "settled" },
    });
    expect(summary.actions["visuals.plan-hosted"]).toBeNull();
  });

  it("blocks a settled plan when scene revisions are swapped across spool images", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const quote = await readCostEstimate(runId);
    const plan = await currentHostedVisualPlan(runId);
    const approval = exactCostApproval(await loadRun(runId), quote.digest);
    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: approval.approvalId,
        bindingDigest: plan.digest,
        quoteDigest: quote.digest,
        confirmPaidOperation: true,
      },
      dependencies: {
        readApiKey: () => "test-bfl-key",
        executeScene: hostedSceneExecutor("swapped") as never,
      },
    });
    const run = await loadRun(runId);
    const loaded = await loadVisualManifest(run);
    const [first, second] = loaded.manifest.scenes;
    const firstActive = first?.revisions.find((item) => item.revision === first.activeRevision);
    const secondActive = second?.revisions.find((item) => item.revision === second.activeRevision);
    if (!first || !second || !firstActive || !secondActive) {
      throw new Error("Expected two active hosted visual revisions.");
    }
    await writeFile(
      artifactPath(runId, "production/visuals/manifest.json"),
      `${JSON.stringify({
        ...loaded.manifest,
        scenes: loaded.manifest.scenes.map((scene) => {
          if (scene.sceneIndex === first.sceneIndex) {
            return {
              ...scene,
              revisions: scene.revisions.map((item) =>
                item.revision === scene.activeRevision ? secondActive : item,
              ),
            };
          }
          if (scene.sceneIndex === second.sceneIndex) {
            return {
              ...scene,
              revisions: scene.revisions.map((item) =>
                item.revision === scene.activeRevision ? firstActive : item,
              ),
            };
          }
          return scene;
        }),
      })}\n`,
      "utf8",
    );

    const summary = await readStudioVisualSummary(process.cwd(), runId);
    expect(summary.hosted).toMatchObject({
      blockedReason: expect.stringMatching(/settled spool image/i),
      plan: { status: "blocked" },
    });
  });
});
