import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { vi } from "vitest";
import { defaultConfig, loadConfig } from "../src/config/config";
import { loadRun } from "../src/core/runStore";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runReadiness } from "../src/stages/readiness";
import { prepareHostedVisualGenerationPlan, prepareStaticVisuals } from "../src/stages/visuals";
import type { HostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlanContracts";
import { loadHostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlanStore";
import { sha256 } from "../src/utils/hash";
import { preparePackagedVisualRun } from "./visualTestHelpers";

/**
 * Prepares a hosted visual generation run with approved cost and readiness checks.
 *
 * @returns The identifier of the prepared run
 */
export async function prepareApprovedHostedVisualRun(): Promise<string> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          imageGeneration: {
            ...defaultConfig.providers.imageGeneration,
            enabled: true,
            mode: "black-forest-labs",
          },
        },
        budgets: { ...defaultConfig.budgets, perVideoUsd: 5, dailyUsd: 10, weeklyUsd: 20 },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const runId = await preparePackagedVisualRun();
  await prepareStaticVisuals(runId);
  await prepareHostedVisualGenerationPlan({ runId, purpose: "initial", sceneIndexes: [1, 2] });
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  await approvePaidGenerationCost(runId);
  await runReadiness(runId);
  return runId;
}

/**
 * Loads the current hosted visual generation plan for a run.
 *
 * @param runId - The identifier of the run whose plan should be loaded
 * @returns The current hosted visual generation plan
 */
export async function currentHostedVisualPlan(runId: string) {
  return loadHostedVisualGenerationPlan(await loadRun(runId), await loadConfig());
}

/**
 * Finds the paid-generation approval matching an exact quote digest.
 *
 * @param run - The loaded workflow run containing approval records.
 * @param quoteDigest - The quote digest that the approval must reference.
 * @returns The matching paid-generation approval.
 * @throws Error if no matching approval exists.
 */
export function exactCostApproval(run: Awaited<ReturnType<typeof loadRun>>, quoteDigest: string) {
  const approval = run.approvals.find(
    (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
  );
  if (!approval) throw new Error("Expected exact paid-generation approval fixture.");
  return approval;
}

/**
 * Creates a deterministic mock executor for hosted scene generation.
 *
 * @param batch - Identifier used to derive generated buffers and provider request IDs.
 * @param billableCredits - Credits reported for each generated scene.
 * @returns A mock executor that produces successful image-generation results with deterministic metadata.
 * @throws Error when the requested scene has no planned prompt.
 */
export function hostedSceneExecutor(batch: string, billableCredits = 9) {
  return vi.fn(
    async ({ plan, sceneIndex }: { plan: HostedVisualGenerationPlan; sceneIndex: number }) => {
      const prompt = plan.scenes.find((scene) => scene.sceneIndex === sceneIndex)?.prompt;
      if (!prompt) throw new Error(`Missing planned prompt for scene ${sceneIndex}.`);
      const buffer = Buffer.from(`${batch}-${sceneIndex}`);
      const requestId = `${batch}-bfl-request-${sceneIndex}`;
      return {
        kind: "success" as const,
        value: {
          buffer,
          digest: createHash("sha256").update(buffer).digest("hex"),
          extension: "jpg" as const,
          media: { bytes: buffer.byteLength, format: "jpeg" as const, width: 1920, height: 1080 },
          provider: {
            service: "black-forest-labs" as const,
            modelId: "flux-2-pro" as const,
            outputFormat: "jpeg" as const,
          },
          providerBilling: {
            source: "provider-reported-credits-approved-tariff-derived-usd" as const,
            billableCredits,
            usdPerCredit: 0.01 as const,
            derivedUsdMicros: billableCredits * 10_000,
          },
          providerRequest: { inputDigest: sha256(prompt), requestIdHash: sha256(requestId) },
        },
        actualUsdMicros: billableCredits * 10_000,
        providerRequestId: requestId,
      };
    },
  );
}
