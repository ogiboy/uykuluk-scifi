import type { ProviderRequestEvidence } from "../../../costs/providerRequestEvidence.js";
import type {
  ReservedProviderAdapter,
  ReservedProviderCallContext,
  ReservedProviderOutcome,
} from "../../../costs/reservedProviderExecution.js";
import { sha256 } from "../../../utils/hash.js";
import { canonicalVisualGenerationDigest } from "../visualGenerationDigest.js";
import type { HostedVisualGenerationPlan } from "../visualGenerationPlanContracts.js";
import {
  blackForestLabsFlux2ProModel,
  blackForestLabsProvider,
  type BlackForestLabsFlux2ProResult,
} from "./blackForestLabsFlux2ProContracts.js";
import {
  executeBlackForestLabsFlux2ProScene,
  type BlackForestLabsFlux2ProDependencies,
} from "./blackForestLabsFlux2ProExecution.js";

export type BlackForestLabsFlux2ProBatchResult = Readonly<{
  images: ReadonlyArray<{
    sceneIndex: number;
    promptDigest: string;
    seed: number;
    result: BlackForestLabsFlux2ProResult;
  }>;
  providerRequests: ProviderRequestEvidence;
}>;

type ExecuteScene = typeof executeBlackForestLabsFlux2ProScene;

export type BlackForestLabsFlux2ProBatchDependencies = BlackForestLabsFlux2ProDependencies & {
  executeScene?: ExecuteScene;
};

/** Creates one sequential reservation-bound adapter for every target in an exact visual plan. */
export function createBlackForestLabsFlux2ProBatchAdapter(input: {
  plan: HostedVisualGenerationPlan;
  bindingDigest: string;
  dependencies?: BlackForestLabsFlux2ProBatchDependencies;
}): ReservedProviderAdapter<BlackForestLabsFlux2ProBatchResult> {
  return {
    provider: blackForestLabsProvider,
    model: blackForestLabsFlux2ProModel,
    bindingDigest: input.bindingDigest,
    execute: (context) => executeBatch(input, context),
  };
}

async function executeBatch(
  input: {
    plan: HostedVisualGenerationPlan;
    bindingDigest: string;
    dependencies?: BlackForestLabsFlux2ProBatchDependencies;
  },
  context: ReservedProviderCallContext,
): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProBatchResult>> {
  const executeScene = input.dependencies?.executeScene ?? executeBlackForestLabsFlux2ProScene;
  const images: BlackForestLabsFlux2ProBatchResult["images"][number][] = [];
  const providerRequests: ProviderRequestEvidence = [];
  const providerRequestIds: string[] = [];
  let actualUsdMicros = 0;

  for (const scene of input.plan.scenes) {
    const outcome = await executeScene({
      plan: input.plan,
      sceneIndex: scene.sceneIndex,
      bindingDigest: input.bindingDigest,
      context,
      dependencies: input.dependencies,
    });
    if (outcome.kind !== "success") {
      if (outcome.kind === "definitely-not-sent" && images.length === 0) return outcome;
      return {
        kind: "unknown",
        reason: outcome.kind === "unknown" ? outcome.reason : "indeterminate",
        ...(outcome.kind === "unknown" && outcome.providerRequestId
          ? { providerRequestId: outcome.providerRequestId }
          : {}),
        requestEvidence: [
          ...providerRequests,
          ...(outcome.kind === "unknown" ? (outcome.requestEvidence ?? []) : []),
        ],
      };
    }
    if (!outcome.providerRequestId) {
      return { kind: "unknown", reason: "indeterminate", requestEvidence: providerRequests };
    }
    providerRequestIds.push(outcome.providerRequestId);
    providerRequests.push({
      requestIndex: providerRequests.length,
      inputDigest: outcome.value.providerRequest.inputDigest,
      requestIdHash: outcome.value.providerRequest.requestIdHash,
      reportedUnits: outcome.value.providerBilling.billableCredits,
    });
    actualUsdMicros += outcome.actualUsdMicros;
    if (!Number.isSafeInteger(actualUsdMicros) || actualUsdMicros > context.maxUsdMicros) {
      return { kind: "unknown", reason: "indeterminate", requestEvidence: providerRequests };
    }
    images.push({
      sceneIndex: scene.sceneIndex,
      promptDigest: scene.promptDigest,
      seed: scene.seed,
      result: outcome.value,
    });
  }

  const resultEvidenceDigest = canonicalVisualGenerationDigest(
    images.map((image) => ({
      sceneIndex: image.sceneIndex,
      digest: image.result.digest,
      billing: image.result.providerBilling,
      providerRequest: image.result.providerRequest,
    })),
  );
  return {
    kind: "success",
    value: { images, providerRequests },
    actualUsdMicros,
    providerRequestId: `batch_${sha256(providerRequestIds.join("\0"))}`,
    resultEvidenceDigest,
  };
}
