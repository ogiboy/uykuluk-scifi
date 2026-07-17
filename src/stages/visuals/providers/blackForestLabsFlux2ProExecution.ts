import { executionBindingDigestSchema } from "../../../costs/providerAdapterIdentity.js";
import {
  type ReservedProviderAdapter,
  type ReservedProviderCallContext,
  type ReservedProviderOutcome,
} from "../../../costs/reservedProviderExecution.js";
import {
  hostedVisualGenerationPlanSchema,
  type HostedVisualGenerationPlan,
} from "../visualGenerationPlanContracts.js";
import {
  blackForestLabsFlux2ProEndpoint,
  blackForestLabsFlux2ProModel,
  blackForestLabsProvider,
  type BlackForestLabsFlux2ProResult,
} from "./blackForestLabsFlux2ProContracts.js";
import {
  waitForBlackForestLabsPoll,
  type FetchLike,
  type WaitForPoll,
} from "./blackForestLabsFlux2ProHttp.js";
import {
  executePreparedBlackForestLabsScene,
  type PreparedBlackForestLabsExecution,
} from "./blackForestLabsFlux2ProRequest.js";

type ExecutionInput = Readonly<{
  plan: HostedVisualGenerationPlan;
  sceneIndex: number;
  bindingDigest: string;
  context: ReservedProviderCallContext;
  dependencies?: BlackForestLabsFlux2ProDependencies;
}>;

export type BlackForestLabsFlux2ProDependencies = Readonly<{
  fetch?: FetchLike;
  readApiKey?: () => string | undefined;
  waitForPoll?: WaitForPoll;
}>;

/**
 * Creates a reservation-bound adapter for executing one FLUX.2 Pro scene.
 *
 * The adapter preserves the plan, selected scene, and binding digest for execution. Provider
 * approval and cost limits are enforced during execution; post-submission failures produce
 * uncertain outcomes with provider request evidence to prevent unsafe retries.
 *
 * @param input - The hosted-visual plan, scene selection, binding digest, and optional execution dependencies.
 * @returns An adapter configured for Black Forest Labs FLUX.2 Pro execution.
 */
export function createBlackForestLabsFlux2ProAdapter(input: {
  plan: HostedVisualGenerationPlan;
  sceneIndex: number;
  bindingDigest: string;
  dependencies?: BlackForestLabsFlux2ProDependencies;
}): ReservedProviderAdapter<BlackForestLabsFlux2ProResult> {
  return {
    provider: blackForestLabsProvider,
    model: blackForestLabsFlux2ProModel,
    bindingDigest: input.bindingDigest,
    execute: (context) => executeBlackForestLabsFlux2ProScene({ ...input, context }),
  };
}

/**
 * Executes one approved FLUX.2 Pro scene within its reservation and records the resulting provider evidence.
 *
 * The request is submitted only when the plan, scene, provider binding, and spending limit are valid.
 * Successful execution returns the validated image and billing details; pre-send validation or cancellation
 * produces a definitive unsent outcome, while provider, transport, timeout, or response-validation failures
 * produce an uncertain outcome with available request evidence.
 *
 * @param input - The scene plan, binding, execution context, and optional provider dependencies.
 * @returns The successful image result or an outcome describing whether execution was unsent,
 * uncertain, or timed out.
 */
export async function executeBlackForestLabsFlux2ProScene(
  input: ExecutionInput,
): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProResult>> {
  const prepared = prepareExecution(input);
  if (!prepared) {
    return { kind: "definitely-not-sent", reason: "adapter-validation" };
  }
  if (input.context.signal.aborted) {
    return { kind: "definitely-not-sent", reason: "cancelled-before-send" };
  }

  const fetchProvider = input.dependencies?.fetch ?? globalThis.fetch;
  const waitForPoll = input.dependencies?.waitForPoll ?? waitForBlackForestLabsPoll;
  return executePreparedBlackForestLabsScene({
    prepared,
    context: input.context,
    fetchProvider,
    waitForPoll,
  });
}

function prepareExecution(input: ExecutionInput): PreparedBlackForestLabsExecution | undefined {
  const plan = hostedVisualGenerationPlanSchema.safeParse(input.plan);
  const binding = executionBindingDigestSchema.safeParse(input.bindingDigest);
  const apiKey = (input.dependencies?.readApiKey ?? (() => process.env.BFL_API_KEY))()?.trim();
  if (
    !plan.success ||
    !binding.success ||
    !apiKey ||
    plan.data.provider !== blackForestLabsProvider ||
    plan.data.model !== blackForestLabsFlux2ProModel ||
    plan.data.settings.endpoint !== blackForestLabsFlux2ProEndpoint ||
    input.context.provider !== blackForestLabsProvider ||
    input.context.model !== blackForestLabsFlux2ProModel ||
    input.context.bindingDigest !== binding.data ||
    !Number.isSafeInteger(input.context.maxUsdMicros) ||
    input.context.maxUsdMicros < 0
  ) {
    return undefined;
  }
  const scene = plan.data.scenes.find((candidate) => candidate.sceneIndex === input.sceneIndex);
  return scene ? { apiKey, plan: plan.data, scene } : undefined;
}
