import { createHash } from "node:crypto";
import type {
  ReservedProviderCallContext,
  ReservedProviderOutcome,
} from "../../../costs/reservedProviderExecution.js";
import { sha256 } from "../../../utils/hash.js";
import type { HostedVisualGenerationPlan } from "../visualGenerationPlanContracts.js";
import { inspectVisualImage } from "../visualImageMetadata.js";
import {
  blackForestLabsFlux2ProModel,
  blackForestLabsProvider,
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
  readBlackForestLabsImageResponse,
  type FetchLike,
} from "./blackForestLabsFlux2ProHttp.js";
import type {
  PreparedBlackForestLabsExecution,
  SubmittedBlackForestLabsRequest,
} from "./blackForestLabsFlux2ProRequest.js";

/** Validates, downloads, and materializes one ready provider result. */
export async function materializeBlackForestLabsReadyScene(
  prepared: PreparedBlackForestLabsExecution,
  submitted: SubmittedBlackForestLabsRequest,
  polledCost: number | undefined,
  resultUrl: string | undefined,
  context: ReservedProviderCallContext,
  fetchProvider: FetchLike,
): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProResult>> {
  const billableCredits = polledCost ?? submitted.submittedCost;
  const billing = deriveBlackForestLabsBilling({
    billableCredits,
    usdPerCredit: prepared.plan.pricing.usdPerCredit,
    sceneMaximumUsd: prepared.scene.maximumUsd,
    reservationMaximumUsdMicros: context.maxUsdMicros,
  });
  if (!billing || !resultUrl || !isSecureProviderResultUrl(resultUrl)) {
    return blackForestLabsUnknownOutcome(
      "indeterminate",
      submitted.providerRequestId,
      submitted.requestEvidence,
    );
  }
  const requestEvidence = [
    blackForestLabsProviderEvidence(prepared.scene, submitted.providerRequestId, billableCredits),
  ];
  try {
    const imageResponse = await fetchProvider(resultUrl, {
      method: "GET",
      redirect: "error",
      headers: { accept: expectedImageContentType(prepared.plan.settings.outputFormat) },
      signal: context.signal,
    });
    const buffer = await readBlackForestLabsImageResponse({
      response: imageResponse,
      outputFormat: prepared.plan.settings.outputFormat,
    });
    const media = await inspectVisualImage(buffer);
    if (!matchesExpectedImage(media, prepared.plan)) {
      return blackForestLabsUnknownOutcome(
        "indeterminate",
        submitted.providerRequestId,
        requestEvidence,
      );
    }
    const resultDigest = createHash("sha256").update(buffer).digest("hex");
    return successfulSceneOutcome(
      prepared,
      submitted.providerRequestId,
      buffer,
      media,
      billing,
      resultDigest,
    );
  } catch {
    return blackForestLabsUnknownOutcome(
      context.signal.aborted ? "timeout" : "transport",
      submitted.providerRequestId,
      requestEvidence,
    );
  }
}

function matchesExpectedImage(
  media: Awaited<ReturnType<typeof inspectVisualImage>>,
  plan: HostedVisualGenerationPlan,
): boolean {
  return (
    media.format === plan.settings.outputFormat &&
    media.width === plan.settings.width &&
    media.height === plan.settings.height
  );
}

function successfulSceneOutcome(
  prepared: PreparedBlackForestLabsExecution,
  providerRequestId: string,
  buffer: Buffer,
  media: Awaited<ReturnType<typeof inspectVisualImage>>,
  billing: BlackForestLabsFlux2ProResult["providerBilling"],
  resultDigest: string,
): ReservedProviderOutcome<BlackForestLabsFlux2ProResult> {
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
