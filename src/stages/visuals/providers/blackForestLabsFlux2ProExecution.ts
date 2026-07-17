import { createHash } from "node:crypto";
import { executionBindingDigestSchema } from "../../../costs/providerAdapterIdentity.js";
import type { ProviderRequestEvidence } from "../../../costs/providerRequestEvidence.js";
import {
  type ReservedProviderAdapter,
  type ReservedProviderCallContext,
  type ReservedProviderOutcome,
} from "../../../costs/reservedProviderExecution.js";
import { sha256 } from "../../../utils/hash.js";
import {
  hostedVisualGenerationPlanSchema,
  type HostedVisualGenerationPlan,
} from "../visualGenerationPlanContracts.js";
import { inspectVisualImage } from "../visualImageMetadata.js";
import {
  blackForestLabsFlux2ProEndpoint,
  blackForestLabsFlux2ProModel,
  blackForestLabsPollResponseSchema,
  blackForestLabsProvider,
  blackForestLabsSubmitResponseSchema,
  type BlackForestLabsFlux2ProResult,
} from "./blackForestLabsFlux2ProContracts.js";
import {
  blackForestLabsProviderEvidence,
  blackForestLabsUnknownOutcome,
  deriveBlackForestLabsBilling,
} from "./blackForestLabsFlux2ProEvidence.js";
import {
  expectedImageContentType,
  isSecureProviderResultUrl,
  isTrustedBflPollingUrl,
  readBlackForestLabsImageResponse,
  readBlackForestLabsJsonResponse,
  waitForBlackForestLabsPoll,
  type FetchLike,
  type WaitForPoll,
} from "./blackForestLabsFlux2ProHttp.js";

type Scene = HostedVisualGenerationPlan["scenes"][number];

export type BlackForestLabsFlux2ProDependencies = Readonly<{
  fetch?: FetchLike;
  readApiKey?: () => string | undefined;
  waitForPoll?: WaitForPoll;
}>;

/**
 * Creates one reservation-bound FLUX.2 Pro scene adapter from an immutable hosted-visual plan.
 *
 * The adapter performs exactly one submit request. Once submit begins, every malformed, failed,
 * timed-out, or over-cap outcome is reported as uncertain so callers cannot retry a possibly
 * billable request blindly.
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

/** Executes a single FLUX.2 Pro scene request for later sequential batch orchestration. */
export async function executeBlackForestLabsFlux2ProScene(input: {
  plan: HostedVisualGenerationPlan;
  sceneIndex: number;
  bindingDigest: string;
  context: ReservedProviderCallContext;
  dependencies?: BlackForestLabsFlux2ProDependencies;
}): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProResult>> {
  const prepared = prepareExecution(input);
  if (!prepared) {
    return { kind: "definitely-not-sent", reason: "adapter-validation" };
  }
  if (input.context.signal.aborted) {
    return { kind: "definitely-not-sent", reason: "cancelled-before-send" };
  }

  const fetchProvider = input.dependencies?.fetch ?? globalThis.fetch;
  const waitForPoll = input.dependencies?.waitForPoll ?? waitForBlackForestLabsPoll;
  let providerRequestId: string | undefined;
  let requestEvidence: ProviderRequestEvidence | undefined;

  try {
    const submitResponse = await fetchProvider(blackForestLabsFlux2ProEndpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-key": prepared.apiKey,
      },
      body: JSON.stringify({
        prompt: prepared.scene.prompt,
        seed: prepared.scene.seed,
        width: prepared.plan.settings.width,
        height: prepared.plan.settings.height,
        safety_tolerance: prepared.plan.settings.safetyTolerance,
        output_format: prepared.plan.settings.outputFormat,
      }),
      signal: input.context.signal,
    });
    if (!submitResponse.ok) {
      return { kind: "unknown", reason: "provider-error" };
    }
    const rawSubmit = await readBlackForestLabsJsonResponse(submitResponse);
    const submit = blackForestLabsSubmitResponseSchema.safeParse(rawSubmit);
    if (!submit.success || !isTrustedBflPollingUrl(submit.data.polling_url)) {
      return { kind: "unknown", reason: "indeterminate" };
    }

    providerRequestId = submit.data.id;
    requestEvidence = [
      blackForestLabsProviderEvidence(prepared.scene, providerRequestId, submit.data.cost),
    ];
    for (let attempt = 0; attempt < prepared.plan.settings.maxPollAttempts; attempt += 1) {
      await waitForPoll(prepared.plan.settings.pollIntervalMs, input.context.signal);
      const pollResponse = await fetchProvider(submit.data.polling_url, {
        method: "GET",
        redirect: "error",
        headers: { accept: "application/json" },
        signal: input.context.signal,
      });
      if (!pollResponse.ok) {
        return blackForestLabsUnknownOutcome("provider-error", providerRequestId, requestEvidence);
      }
      const rawPoll = await readBlackForestLabsJsonResponse(pollResponse);
      const poll = blackForestLabsPollResponseSchema.safeParse(rawPoll);
      if (!poll.success || (poll.data.id !== undefined && poll.data.id !== providerRequestId)) {
        return blackForestLabsUnknownOutcome("indeterminate", providerRequestId, requestEvidence);
      }
      if (poll.data.status === "Pending") {
        continue;
      }
      if (poll.data.status !== "Ready") {
        return blackForestLabsUnknownOutcome("provider-error", providerRequestId, requestEvidence);
      }

      const billableCredits = poll.data.cost ?? submit.data.cost;
      const billing = deriveBlackForestLabsBilling({
        billableCredits,
        usdPerCredit: prepared.plan.pricing.usdPerCredit,
        sceneMaximumUsd: prepared.scene.maximumUsd,
        reservationMaximumUsdMicros: input.context.maxUsdMicros,
      });
      if (!billing || !poll.data.result || !isSecureProviderResultUrl(poll.data.result.sample)) {
        return blackForestLabsUnknownOutcome("indeterminate", providerRequestId, requestEvidence);
      }
      requestEvidence = [
        blackForestLabsProviderEvidence(prepared.scene, providerRequestId, billableCredits),
      ];

      const imageResponse = await fetchProvider(poll.data.result.sample, {
        method: "GET",
        redirect: "error",
        headers: { accept: expectedImageContentType(prepared.plan.settings.outputFormat) },
        signal: input.context.signal,
      });
      const buffer = await readBlackForestLabsImageResponse({
        response: imageResponse,
        outputFormat: prepared.plan.settings.outputFormat,
      });
      const media = await inspectVisualImage(buffer);
      if (
        media.format !== prepared.plan.settings.outputFormat ||
        media.width !== prepared.plan.settings.width ||
        media.height !== prepared.plan.settings.height
      ) {
        return blackForestLabsUnknownOutcome("indeterminate", providerRequestId, requestEvidence);
      }
      const resultDigest = createHash("sha256").update(buffer).digest("hex");

      return {
        kind: "success",
        value: {
          buffer,
          digest: resultDigest,
          extension: media.format === "jpeg" ? "jpg" : "png",
          media,
          provider: {
            service: blackForestLabsProvider,
            modelId: blackForestLabsFlux2ProModel,
            outputFormat: prepared.plan.settings.outputFormat,
          },
          providerBilling: billing,
          providerRequest: {
            inputDigest: sha256(prepared.scene.prompt),
            requestIdHash: sha256(providerRequestId),
          },
        },
        actualUsdMicros: billing.derivedUsdMicros,
        providerRequestId,
        resultEvidenceDigest: resultDigest,
      };
    }
    return blackForestLabsUnknownOutcome("timeout", providerRequestId, requestEvidence);
  } catch {
    return blackForestLabsUnknownOutcome(
      input.context.signal.aborted ? "timeout" : "transport",
      providerRequestId,
      requestEvidence,
    );
  }
}

function prepareExecution(input: {
  plan: HostedVisualGenerationPlan;
  sceneIndex: number;
  bindingDigest: string;
  context: ReservedProviderCallContext;
  dependencies?: BlackForestLabsFlux2ProDependencies;
}): { apiKey: string; plan: HostedVisualGenerationPlan; scene: Scene } | undefined {
  const plan = hostedVisualGenerationPlanSchema.safeParse(input.plan);
  const binding = executionBindingDigestSchema.safeParse(input.bindingDigest);
  const apiKey = (input.dependencies?.readApiKey ?? (() => process.env.BFL_API_KEY))()?.trim();
  if (
    !plan.success ||
    !binding.success ||
    !apiKey ||
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
