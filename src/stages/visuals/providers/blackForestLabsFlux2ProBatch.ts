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

type BatchImage = BlackForestLabsFlux2ProBatchResult["images"][number];
type SceneOutcome = Awaited<ReturnType<ExecuteScene>>;
type SuccessfulSceneOutcome = Extract<SceneOutcome, { kind: "success" }>;

type BatchAccumulator = {
  images: BatchImage[];
  providerRequests: ProviderRequestEvidence;
  providerRequestIds: string[];
  actualUsdMicros: number;
};

export type BlackForestLabsFlux2ProBatchDependencies = BlackForestLabsFlux2ProDependencies & {
  executeScene?: ExecuteScene;
};

/**
 * Creates a reservation-bound adapter that executes each scene in the exact visual plan sequentially.
 *
 * The adapter preserves the supplied binding digest and reports consolidated scene results,
 * provider-request evidence, cost usage, and indeterminate outcomes through its execution contract.
 *
 * @param input - The visual plan, binding digest, and optional scene execution dependencies.
 * @returns An adapter configured for the Black Forest Labs Flux 2 Pro batch model.
 */
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

/**
 * Executes the planned scenes sequentially and aggregates their results and provider evidence.
 *
 * The batch remains within the authorized budget and returns an indeterminate outcome when
 * execution status, request identity, evidence, or accumulated cost cannot be established.
 *
 * @param input - The scene plan, reservation binding, and optional scene execution dependencies.
 * @returns A successful batch with per-scene images, request evidence, total cost, and deterministic
 * batch identity, or an outcome describing an unconfirmed or unsent execution.
 */
async function executeBatch(
  input: {
    plan: HostedVisualGenerationPlan;
    bindingDigest: string;
    dependencies?: BlackForestLabsFlux2ProBatchDependencies;
  },
  context: ReservedProviderCallContext,
): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProBatchResult>> {
  const executeScene = input.dependencies?.executeScene ?? executeBlackForestLabsFlux2ProScene;
  const accumulator: BatchAccumulator = {
    images: [],
    providerRequests: [],
    providerRequestIds: [],
    actualUsdMicros: 0,
  };

  for (const scene of input.plan.scenes) {
    const outcome = await executeScene({
      plan: input.plan,
      sceneIndex: scene.sceneIndex,
      bindingDigest: input.bindingDigest,
      context,
      dependencies: input.dependencies,
    });
    if (outcome.kind !== "success") {
      return incompleteBatchOutcome(outcome, accumulator);
    }
    const accumulationFailure = accumulateSuccessfulScene(
      accumulator,
      scene,
      outcome,
      context.maxUsdMicros,
    );
    if (accumulationFailure) return accumulationFailure;
  }

  const resultEvidenceDigest = canonicalVisualGenerationDigest(
    accumulator.images.map((image) => ({
      sceneIndex: image.sceneIndex,
      digest: image.result.digest,
      billing: image.result.providerBilling,
      providerRequest: image.result.providerRequest,
    })),
  );
  return {
    kind: "success",
    value: { images: accumulator.images, providerRequests: accumulator.providerRequests },
    actualUsdMicros: accumulator.actualUsdMicros,
    providerRequestId: `batch_${sha256(accumulator.providerRequestIds.join("\0"))}`,
    resultEvidenceDigest,
  };
}

function incompleteBatchOutcome(
  outcome: Exclude<SceneOutcome, { kind: "success" }>,
  accumulator: BatchAccumulator,
): ReservedProviderOutcome<BlackForestLabsFlux2ProBatchResult> {
  if (outcome.kind === "definitely-not-sent" && accumulator.images.length === 0) return outcome;
  const unknownOutcome = outcome.kind === "unknown" ? outcome : undefined;
  return {
    kind: "unknown",
    reason: unknownOutcome?.reason ?? "indeterminate",
    ...(unknownOutcome?.providerRequestId
      ? { providerRequestId: unknownOutcome.providerRequestId }
      : {}),
    requestEvidence: [...accumulator.providerRequests, ...(unknownOutcome?.requestEvidence ?? [])],
  };
}

function accumulateSuccessfulScene(
  accumulator: BatchAccumulator,
  scene: HostedVisualGenerationPlan["scenes"][number],
  outcome: SuccessfulSceneOutcome,
  maximumUsdMicros: number,
): ReservedProviderOutcome<BlackForestLabsFlux2ProBatchResult> | undefined {
  if (!outcome.providerRequestId) {
    return {
      kind: "unknown",
      reason: "indeterminate",
      requestEvidence: accumulator.providerRequests,
    };
  }
  accumulator.providerRequestIds.push(outcome.providerRequestId);
  accumulator.providerRequests.push({
    requestIndex: accumulator.providerRequests.length,
    inputDigest: outcome.value.providerRequest.inputDigest,
    requestIdHash: outcome.value.providerRequest.requestIdHash,
    reportedUnits: outcome.value.providerBilling.billableCredits,
  });
  accumulator.actualUsdMicros += outcome.actualUsdMicros;
  if (
    !Number.isSafeInteger(accumulator.actualUsdMicros) ||
    accumulator.actualUsdMicros > maximumUsdMicros
  ) {
    return {
      kind: "unknown",
      reason: "indeterminate",
      requestEvidence: accumulator.providerRequests,
    };
  }
  accumulator.images.push({
    sceneIndex: scene.sceneIndex,
    promptDigest: scene.promptDigest,
    seed: scene.seed,
    result: outcome.value,
  });
  return undefined;
}
