import { writeFile } from "node:fs/promises";
import { expect } from "vitest";
import { defaultConfig } from "../src/config/config";
import { loadRun } from "../src/core/runStore";
import { defaultStagePricing } from "../src/costs/pricing";
import { ReservedProviderAdapter } from "../src/costs/reservedProviderExecution";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";

export const paidAdapterIdentity = { provider: "future-paid-tts" } as const;

export function reservedAdapter<T>(
  execute: ReservedProviderAdapter<T>["execute"],
  provider: string = paidAdapterIdentity.provider,
): ReservedProviderAdapter<T> {
  return { provider, execute };
}

export async function prepareReadyPaidRun(): Promise<string> {
  defaultStagePricing.tts.estimatedUsd = 0.02;
  defaultStagePricing.tts.provider = "future-paid-tts";
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: { ...defaultConfig.providers.tts, enabled: true },
        },
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
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  await estimateCost(runId);
  await generateEvidenceBundle(runId);
  await approvePaidGenerationCost(runId);
  await runReadiness(runId);
  expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  return runId;
}
