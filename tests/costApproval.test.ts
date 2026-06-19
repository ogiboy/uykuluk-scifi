import { readFile, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { appendCostEvent, readCostEvents } from "../src/costs/costLedger";
import { readCostEstimate } from "../src/costs/costEstimate";
import { defaultStagePricing } from "../src/costs/pricing";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { readJsonFile } from "../src/utils/json";
import { nowIso } from "../src/utils/time";
import { useTempProject } from "./helpers";

describe("paid generation cost approval", () => {
  useTempProject();

  const originalTtsPrice = defaultStagePricing.tts.estimatedUsd;
  const originalTtsProvider = defaultStagePricing.tts.provider;

  afterEach(() => {
    defaultStagePricing.tts.estimatedUsd = originalTtsPrice;
    defaultStagePricing.tts.provider = originalTtsProvider;
  });

  it("binds approval to the exact persisted quote and permits readiness", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0.02 });

    const beforeApproval = await runReadiness(runId);
    expect(beforeApproval.passed).toBe(false);
    expect(
      beforeApproval.checks.find((check) => check.name === "budget not exceeded"),
    ).toMatchObject({
      status: "block",
      message: expect.stringMatching(/explicit paid-generation cost approval/i),
    });
    const pendingEvidence = await readJsonFile<{
      costQuote: { approvalRequired: boolean; approved: boolean };
      nextRecommendedCommand: string;
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(pendingEvidence.costQuote).toMatchObject({
      approvalRequired: true,
      approved: false,
    });
    expect(pendingEvidence.nextRecommendedCommand).toContain("producer approve cost");

    const quoteDigest = (await readCostEstimate(runId)).digest;
    const costEventsBeforeApproval = await readCostEvents(runId);
    const approval = await approvePaidGenerationCost(runId);

    expect(approval.target).toBe("paid-generation-cost");
    expect(approval.approvedRef).toBe(quoteDigest);
    expect((await loadRun(runId)).state).toBe("PAID_GENERATION_COST_APPROVED");
    expect(await readCostEvents(runId)).toEqual(costEventsBeforeApproval);

    const readiness = await runReadiness(runId);
    expect(readiness.passed).toBe(true);
    expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
    const approvedEvidence = await readJsonFile<{
      costQuote: { digest: string; approved: boolean; approvalId: string };
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(approvedEvidence.costQuote).toMatchObject({
      digest: approval.approvedRef,
      approved: true,
      approvalId: approval.approvalId,
    });
  });

  it("blocks readiness when the quote changes after approval", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0.02 });
    await approvePaidGenerationCost(runId);
    const target = artifactPath(runId, "costs/estimate.json");
    const quote = JSON.parse(await readFile(target, "utf8")) as Record<string, unknown>;
    await writeFile(target, `${JSON.stringify({ ...quote, estimatedStageCost: 0.03 }, null, 2)}\n`);

    const readiness = await runReadiness(runId);

    expect(readiness.passed).toBe(false);
    expect(readiness.checks.find((check) => check.name === "budget not exceeded")).toMatchObject({
      status: "block",
      message: expect.stringMatching(/changed after approval|invalid/i),
    });
    expect((await loadRun(runId)).state).toBe("PAID_GENERATION_COST_APPROVED");
  });

  it("rejects a quote whose displayed stages were tampered before approval", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0.02 });
    const target = artifactPath(runId, "costs/estimate.json");
    const quote = JSON.parse(await readFile(target, "utf8")) as {
      stages: Array<Record<string, unknown>>;
    };
    quote.stages = quote.stages.map((stage) =>
      stage.stage === "tts" ? { ...stage, provider: "misleading-provider" } : stage,
    );
    await writeFile(target, `${JSON.stringify(quote, null, 2)}\n`);

    await expect(approvePaidGenerationCost(runId)).rejects.toThrow(
      /stages|pricing|markdown|invalid/i,
    );
    expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
  });

  it("rejects a tampered operator-facing quote before approval", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0.02 });
    await writeFile(
      artifactPath(runId, "costs/estimate.md"),
      "# Cost Estimate\n\nEstimated USD: 0.0000\n",
    );

    await expect(approvePaidGenerationCost(runId)).rejects.toThrow(/markdown|quote|invalid/i);
    expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
  });

  it("reports an invalid persisted quote and recommends regeneration", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0.02 });
    await writeFile(artifactPath(runId, "costs/estimate.json"), '{"invalid":true}\n');

    await generateEvidenceBundle(runId);

    const evidence = await readJsonFile<{
      costQuote: { invalid: boolean; invalidReason: string };
      nextRecommendedCommand: string;
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(evidence.costQuote).toMatchObject({
      invalid: true,
      invalidReason: expect.stringMatching(/invalid|expected|schema/i),
    });
    expect(evidence.nextRecommendedCommand).toContain("estimate");
    expect(evidence.nextRecommendedCommand).toContain("invalid");
  });

  it("rechecks live hard budgets after approval", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0.02 });
    await approvePaidGenerationCost(runId);
    await appendCostEvent({
      runId,
      stage: "external-cost-drift",
      provider: "test",
      estimatedUsd: 0.49,
      createdAt: nowIso(),
    });

    const readiness = await runReadiness(runId);

    expect(readiness.passed).toBe(false);
    expect(readiness.checks.find((check) => check.name === "budget not exceeded")).toMatchObject({
      status: "block",
      message: expect.stringMatching(/hard-budget decision changed|budget/i),
    });
    expect((await loadRun(runId)).state).toBe("PAID_GENERATION_COST_APPROVED");
  });

  it("does not allow approval to override hard budgets", async () => {
    const runId = await prepareQuotedRun({
      estimatedUsd: 0.6,
      budgets: {
        ...defaultConfig.budgets,
        perVideoUsd: 0.5,
        dailyUsd: 1,
        weeklyUsd: 5,
        requireApprovalAboveUsd: 0.01,
      },
    });

    await expect(approvePaidGenerationCost(runId)).rejects.toThrow(/hard budget|budget/i);
    expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
  });

  it("rejects cost approval when the quote does not require it", async () => {
    const runId = await prepareQuotedRun({ estimatedUsd: 0 });

    await expect(approvePaidGenerationCost(runId)).rejects.toThrow(/does not require/i);
    expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
  });
});

async function prepareQuotedRun(input: {
  estimatedUsd: number;
  budgets?: typeof defaultConfig.budgets;
}): Promise<string> {
  defaultStagePricing.tts.estimatedUsd = input.estimatedUsd;
  defaultStagePricing.tts.provider = "future-paid-tts";
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: {
            ...defaultConfig.providers.tts,
            enabled: true,
          },
        },
        budgets: input.budgets ?? defaultConfig.budgets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId);
  await generateProductionPackage(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  return runId;
}
