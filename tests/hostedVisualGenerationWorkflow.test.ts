import { describe, expect, it, vi } from "vitest";
import {
  readStudioVisualMedia,
  readStudioVisualSummary,
} from "../apps/studio/src/lib/runs/visualSummaries";
import { loadConfig } from "../src/config/config";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate, validateCostEstimateIntegrity } from "../src/costs/costEstimate";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { generateHostedVisuals } from "../src/stages/visuals";
import { applySettledHostedVisuals } from "../src/stages/visuals/hostedVisualManifestApply";
import { loadHostedVisualGenerationSpoolForOperation } from "../src/stages/visuals/visualGenerationSpool";
import { loadVisualManifest } from "../src/stages/visuals/visualManifest";
import { useTempProject } from "./helpers";
import {
  currentHostedVisualPlan,
  hostedSceneExecutor,
  prepareApprovedHostedVisualRun,
} from "./hostedVisualWorkflowTestHelpers";

describe("hosted visual generation workflow", () => {
  useTempProject();

  it("settles one approved batch and promotes operation-owned images into review", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const quote = await readCostEstimate(runId);
    const { digest: quoteDigest } = quote;
    const run = await loadRun(runId);
    const approval = run.approvals.find(
      (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
    );
    const plan = await preparePlanIdentity(runId);
    const readySummary = await readStudioVisualSummary(process.cwd(), runId);
    expect(readySummary.hosted).toMatchObject({
      approval: { approvalId: approval!.approvalId, status: "approved" },
      execution: { approvalId: approval!.approvalId, bindingDigest: plan.planDigest, quoteDigest },
      mode: "hosted",
      plan: { status: "ready" },
      quote: { estimatedUsd: 0.18, status: "ready" },
    });
    expect(readySummary.actions["visuals.generate-hosted"]).toMatchObject({
      routePath: "/actions/visuals-generate-hosted",
    });
    const executeScene = hostedSceneExecutor("hosted-image");

    const manifest = await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: approval!.approvalId,
        bindingDigest: plan.planDigest,
        quoteDigest,
        confirmPaidOperation: true,
      },
      dependencies: { readApiKey: () => "test-bfl-key", executeScene: executeScene as never },
    });

    expect(executeScene).toHaveBeenCalledTimes(2);
    expect(manifest.scenes.slice(0, 2).map((scene) => scene.revisions.at(-1)?.provider)).toEqual([
      "black-forest-labs",
      "black-forest-labs",
    ]);
    expect(manifest.scenes[0]?.revisions.at(-1)?.asset.path).toMatch(
      /^operations\/image-generation\/image_[a-f0-9]{64}\/scene_001\.jpg$/,
    );
    expect(await readCostReservationSummaries(runId)).toContainEqual(
      expect.objectContaining({
        stage: "imageGeneration",
        status: "SETTLED",
        actualUsdMicros: 180_000,
        bindingDigest: plan.planDigest,
      }),
    );
    await expect(
      validateCostEstimateIntegrity(
        await loadRun(runId),
        await loadConfig(),
        quote.estimate,
        quote.digest,
      ),
    ).resolves.toEqual([]);
    const persisted = await loadVisualManifest(await loadRun(runId));
    expect(persisted.manifest.scenes[0]?.revisions.at(-1)?.source).toMatchObject({
      kind: "hosted-generation",
      service: "black-forest-labs",
      modelId: "flux-2-pro",
    });
    const summary = await readStudioVisualSummary(process.cwd(), runId);
    const firstScene = summary.scenes[0]!;
    const media = await readStudioVisualMedia(
      process.cwd(),
      runId,
      firstScene.sceneIndex,
      summary.manifestDigest!,
      firstScene.activeRevision,
      null,
    );
    expect(media.status).toBe(200);
    if (media.status === 200 || media.status === 206) {
      expect(Buffer.from(media.body).toString("utf8")).toBe("hosted-image-1");
    }
  });

  it("blocks stale browser confirmation before provider submission", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const { digest: quoteDigest } = await readCostEstimate(runId);
    const run = await loadRun(runId);
    const approval = run.approvals.find((item) => item.target === "paid-generation-cost");
    const executeScene = vi.fn();

    await expect(
      generateHostedVisuals({
        runId,
        confirmation: {
          approvalId: approval!.approvalId,
          bindingDigest: "f".repeat(64),
          quoteDigest,
          confirmPaidOperation: true,
        },
        dependencies: { readApiKey: () => undefined, executeScene: executeScene as never },
      }),
    ).rejects.toThrow(/confirmation is stale/i);

    expect(executeScene).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "GUARD_BLOCKED",
        stage: "visuals-hosted-execution-preflight",
        data: expect.objectContaining({ reason: "hosted-execution-confirmation-mismatch" }),
      }),
    );
  });

  it("rejects a settlement whose result digest does not match the committed spool", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const { digest: quoteDigest } = await readCostEstimate(runId);
    const run = await loadRun(runId);
    const approval = run.approvals.find(
      (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
    )!;
    const plan = await currentHostedVisualPlan(runId);
    await generateHostedVisuals({
      runId,
      confirmation: {
        approvalId: approval.approvalId,
        bindingDigest: plan.digest,
        quoteDigest,
        confirmPaidOperation: true,
      },
      dependencies: {
        readApiKey: () => "test-bfl-key",
        executeScene: hostedSceneExecutor("digest-binding") as never,
      },
    });
    const reservation = (await readCostReservationSummaries(runId)).find(
      (item) => item.stage === "imageGeneration" && item.status === "SETTLED",
    )!;
    const spool = await loadHostedVisualGenerationSpoolForOperation(
      runId,
      reservation.operationId,
      reservation.resultEvidenceDigest!,
    );

    await expect(
      applySettledHostedVisuals({
        runId,
        plan,
        spool,
        reservation: { ...reservation, resultEvidenceDigest: "f".repeat(64) },
      }),
    ).rejects.toThrow(/settlement does not match/i);
  });

  it("settles a committed spool after restart without requiring the provider key again", async () => {
    const runId = await prepareApprovedHostedVisualRun();
    const { digest: quoteDigest } = await readCostEstimate(runId);
    const run = await loadRun(runId);
    const approval = run.approvals.find(
      (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
    )!;
    const plan = await preparePlanIdentity(runId);
    const executeScene = hostedSceneExecutor("recovery-hosted-image");
    const confirmation = {
      approvalId: approval.approvalId,
      bindingDigest: plan.planDigest,
      quoteDigest,
      confirmPaidOperation: true as const,
    };

    await expect(
      generateHostedVisuals({
        runId,
        confirmation,
        dependencies: {
          readApiKey: () => "test-bfl-key",
          executeScene: executeScene as never,
          afterSuccessfulExecutionCommitted: async () => {
            throw new Error("simulated restart after committed provider result");
          },
        },
      }),
    ).rejects.toThrow(/simulated restart/i);
    expect(await readCostReservationSummaries(runId)).toContainEqual(
      expect.objectContaining({ stage: "imageGeneration", status: "SETTLEMENT_PENDING" }),
    );

    const recovered = await generateHostedVisuals({ runId, confirmation });

    expect(executeScene).toHaveBeenCalledTimes(2);
    expect(recovered.scenes[0]?.revisions.at(-1)?.source).toMatchObject({
      kind: "hosted-generation",
      quoteDigest,
    });
    expect(await readCostReservationSummaries(runId)).toContainEqual(
      expect.objectContaining({ stage: "imageGeneration", status: "SETTLED" }),
    );
    await expect(generateHostedVisuals({ runId, confirmation })).resolves.toEqual(recovered);
    expect(executeScene).toHaveBeenCalledTimes(2);
  });
});

async function preparePlanIdentity(runId: string) {
  const loaded = await currentHostedVisualPlan(runId);
  return { planDigest: loaded.digest, scenes: loaded.plan.scenes };
}
