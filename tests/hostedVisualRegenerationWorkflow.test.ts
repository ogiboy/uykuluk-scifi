import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate, readCostEstimateByDigestAtProjectRoot } from "../src/costs/costEstimate";
import { reserveApprovedCost } from "../src/costs/costReservationService";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { estimateCost } from "../src/stages/estimate";
import {
  decideVisuals,
  generateHostedVisuals,
  prepareHostedVisualGenerationPlan,
} from "../src/stages/visuals";
import { readHostedVisualGenerationRevision } from "../src/stages/visuals/visualGenerationRevision";
import { loadVisualManifest } from "../src/stages/visuals/visualManifest";
import { useTempProject } from "./helpers";
import {
  currentHostedVisualPlan,
  exactCostApproval,
  hostedSceneExecutor,
  prepareApprovedHostedVisualRun,
} from "./hostedVisualWorkflowTestHelpers";
import { currentVisualExpectation } from "./visualTestHelpers";

describe("hosted visual rejected-scene regeneration", () => {
  useTempProject();

  it("archives the settled batch identity and regenerates only rejected scenes", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const firstQuote = await readCostEstimate(runId);
    const firstPlan = await currentHostedVisualPlan(runId);
    const firstApproval = exactCostApproval(await loadRun(runId), firstQuote.digest);
    const firstExecute = hostedSceneExecutor("first");

    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: firstApproval.approvalId,
        bindingDigest: firstPlan.digest,
        quoteDigest: firstQuote.digest,
        confirmPaidOperation: true,
      },
      dependencies: { readApiKey: () => "test-bfl-key", executeScene: firstExecute as never },
    });
    const firstManifest = await loadVisualManifest(await loadRun(runId));
    const firstSceneOneRevision = firstManifest.manifest.scenes[0]!.activeRevision;
    const firstSceneTwoRevision = firstManifest.manifest.scenes[1]!.activeRevision;

    await expect(
      prepareHostedVisualGenerationPlan({
        ...(await currentVisualExpectation(runId)),
        runId,
        purpose: "regenerate-rejected",
        sceneIndexes: [1],
        reviewedBy: "visual director",
        reason: "Invalid regeneration target before rejection.",
      }),
    ).rejects.toThrow(/must reject its active revision/i);
    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "GUARD_BLOCKED",
        stage: "visuals-hosted-reopen",
        message: expect.stringMatching(/must reject its active revision/i),
      }),
    );

    await decideVisuals({
      runId,
      sceneIndexes: [1, 3],
      status: "rejected",
      reviewedBy: "visual director",
      notes: "Scene one needs a hosted revision; unrelated static scene three stays rejected.",
      ...(await currentVisualExpectation(runId)),
    });
    await prepareHostedVisualGenerationPlan({
      ...(await currentVisualExpectation(runId)),
      runId,
      purpose: "regenerate-rejected",
      sceneIndexes: [1],
      reviewedBy: "visual director",
      reason: "Regenerate the rejected scientific scene only.",
    });
    const reopened = await loadRun(runId);
    const revisionPath = reopened.artifacts.find((relativePath) =>
      /^revisions\/hosted-visual\/[^/]+\/revision\.json$/.test(relativePath),
    );
    if (!revisionPath) throw new Error("Expected hosted visual revision evidence.");
    const revision = await readHostedVisualGenerationRevision(runId, revisionPath.split("/")[2]!);
    expect(revision).toMatchObject({
      previousState: "READY_FOR_MANUAL_PRODUCTION",
      nextState: "PRODUCTION_PACKAGE_GENERATED",
      previousPlan: { digest: firstPlan.digest },
      previousQuote: { digest: firstQuote.digest, approvalId: firstApproval.approvalId },
      rejectedSceneIndexes: [1],
    });
    const revisionFile = artifactPath(runId, revisionPath);
    await writeFile(
      revisionFile,
      `${JSON.stringify({
        ...revision,
        previousQuote: { ...revision.previousQuote, approvalId: "approval_tampered" },
      })}\n`,
      "utf8",
    );
    await expect(
      readHostedVisualGenerationRevision(runId, revisionPath.split("/")[2]!),
    ).rejects.toThrow(/quote approval/i);
    await writeFile(
      revisionFile,
      `${JSON.stringify({ ...revision, settledReservationIds: ["reservation_tampered"] })}\n`,
      "utf8",
    );
    await expect(
      readHostedVisualGenerationRevision(runId, revisionPath.split("/")[2]!),
    ).rejects.toThrow(/reservation identities/i);
    await writeFile(revisionFile, `${JSON.stringify(revision)}\n`, "utf8");
    expect(reopened.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    expect(reopened.approvals).toContainEqual(firstApproval);
    await expect(
      readCostEstimateByDigestAtProjectRoot(process.cwd(), reopened, firstQuote.digest),
    ).resolves.toMatchObject({ digest: firstQuote.digest });

    await estimateCost(runId);
    const secondQuote = await readCostEstimate(runId);
    expect(secondQuote.digest).not.toBe(firstQuote.digest);
    expect(
      secondQuote.estimate.stages.find((stage) => stage.stage === "imageGeneration"),
    ).toMatchObject({ enabled: true, estimatedUsd: 0.09 });
    const secondApproval = await approvePaidGenerationCost(runId);
    expect((await loadRun(runId)).state).toBe("PAID_GENERATION_COST_APPROVED");
    const secondPlan = await currentHostedVisualPlan(runId);
    const secondExecute = hostedSceneExecutor("second");

    const regenerated = await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: secondApproval.approvalId,
        bindingDigest: secondPlan.digest,
        quoteDigest: secondQuote.digest,
        confirmPaidOperation: true,
      },
      dependencies: { readApiKey: () => "test-bfl-key", executeScene: secondExecute as never },
    });

    expect(secondExecute).toHaveBeenCalledTimes(1);
    expect(secondExecute).toHaveBeenCalledWith(expect.objectContaining({ sceneIndex: 1 }));
    expect(regenerated.scenes[0]!.activeRevision).toBe(firstSceneOneRevision + 1);
    expect(regenerated.scenes[1]!.activeRevision).toBe(firstSceneTwoRevision);
    expect(regenerated.scenes[1]!.revisions).toEqual(firstManifest.manifest.scenes[1]!.revisions);
    expect((await loadRun(runId)).approvals).toEqual(
      expect.arrayContaining([firstApproval, secondApproval]),
    );
    expect(await readCostReservationSummaries(runId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bindingDigest: firstPlan.digest,
          stage: "imageGeneration",
          status: "SETTLED",
        }),
        expect.objectContaining({
          bindingDigest: secondPlan.digest,
          stage: "imageGeneration",
          status: "SETTLED",
        }),
      ]),
    );
  });

  it("serializes rejected-scene reopening against a concurrent reservation", async () => {
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
        executeScene: hostedSceneExecutor("concurrent") as never,
      },
    });
    await decideVisuals({
      runId,
      sceneIndexes: [1],
      status: "rejected",
      reviewedBy: "visual director",
      notes: "Scene one needs a new hosted revision.",
      ...(await currentVisualExpectation(runId)),
    });

    const reservationCheckReached = deferred();
    const releaseRevision = deferred();
    const revisionPromise = prepareHostedVisualGenerationPlan(
      {
        ...(await currentVisualExpectation(runId)),
        runId,
        purpose: "regenerate-rejected",
        reason: "Reopen while another operation attempts to reserve the spent quote.",
        reviewedBy: "visual director",
        sceneIndexes: [1],
      },
      {
        afterReservationCheck: async () => {
          reservationCheckReached.resolve();
          await releaseRevision.promise;
        },
      },
    );
    await reservationCheckReached.promise;
    const reservationContentionReached = deferred();
    const reservationPromise = reserveApprovedCost(
      {
        runId,
        stage: "imageGeneration",
        operationId: "image_generation_concurrent_reopen",
        adapterIdentity: {
          provider: "black-forest-labs",
          model: "flux-2-pro",
          bindingDigest: plan.digest,
        },
      },
      { onLockContention: reservationContentionReached.resolve },
    );
    await reservationContentionReached.promise;
    releaseRevision.resolve();

    const [revisionResult, reservationResult] = await Promise.allSettled([
      revisionPromise,
      reservationPromise,
    ]);
    expect(revisionResult.status).toBe("fulfilled");
    expect(reservationResult.status).toBe("rejected");
    expect((await loadRun(runId)).state).toBe("PRODUCTION_PACKAGE_GENERATED");
    expect(
      (await readCostReservationSummaries(runId)).filter(
        (reservation) => reservation.stage === "imageGeneration",
      ),
    ).toHaveLength(1);
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  return {
    promise: new Promise<void>((resolvePromise) => {
      resolve = resolvePromise;
    }),
    resolve,
  };
}
