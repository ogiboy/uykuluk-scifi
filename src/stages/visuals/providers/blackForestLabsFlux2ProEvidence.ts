import { usdToMicrosCeil } from "../../../costs/money.js";
import type { ProviderRequestEvidence } from "../../../costs/providerRequestEvidence.js";
import type {
  ReservedProviderCallContext,
  ReservedProviderOutcome,
} from "../../../costs/reservedProviderExecution.js";
import { sha256 } from "../../../utils/hash.js";
import type { HostedVisualGenerationPlan } from "../visualGenerationPlanContracts.js";
import type { BlackForestLabsFlux2ProResult } from "./blackForestLabsFlux2ProContracts.js";

type Scene = HostedVisualGenerationPlan["scenes"][number];

/**
 * Derives approved billing from provider-reported credits when the amount is valid and within both scene and reservation cost limits.
 *
 * @param input - Reported credits, approved tariff, and maximum allowed costs for the scene and reservation.
 * @returns The derived provider billing details, or `undefined` when credits are invalid or the derived cost exceeds either limit.
 */
export function deriveBlackForestLabsBilling(input: {
  billableCredits: number | undefined;
  usdPerCredit: 0.01;
  sceneMaximumUsd: number;
  reservationMaximumUsdMicros: ReservedProviderCallContext["maxUsdMicros"];
}): BlackForestLabsFlux2ProResult["providerBilling"] | undefined {
  if (
    input.billableCredits === undefined ||
    !Number.isFinite(input.billableCredits) ||
    input.billableCredits < 0
  ) {
    return undefined;
  }
  const derivedUsdMicros = usdToMicrosCeil(input.billableCredits * input.usdPerCredit);
  if (
    derivedUsdMicros > usdToMicrosCeil(input.sceneMaximumUsd) ||
    derivedUsdMicros > input.reservationMaximumUsdMicros
  ) {
    return undefined;
  }
  return {
    source: "provider-reported-credits-approved-tariff-derived-usd",
    billableCredits: input.billableCredits,
    usdPerCredit: input.usdPerCredit,
    derivedUsdMicros,
  };
}

/**
 * Builds evidence identifying a Black Forest Labs provider request for a scene.
 *
 * @param scene - The scene associated with the provider request.
 * @param providerRequestId - The provider-assigned request identifier.
 * @param reportedUnits - Provider-reported usage units, when available.
 * @returns Evidence containing the zero-based scene index, prompt digest, request ID hash, and optional reported usage units.
 */
export function blackForestLabsProviderEvidence(
  scene: Scene,
  providerRequestId: string,
  reportedUnits: number | undefined,
): ProviderRequestEvidence[number] {
  return {
    requestIndex: scene.sceneIndex - 1,
    inputDigest: sha256(scene.prompt),
    requestIdHash: sha256(providerRequestId),
    ...(reportedUnits === undefined ? {} : { reportedUnits }),
  };
}

/**
 * Creates an unknown provider outcome for a Black Forest Labs request.
 *
 * @param reason - The reason the provider outcome is unknown.
 * @param providerRequestId - The provider request identifier, when available.
 * @param requestEvidence - Evidence associated with the provider request, when available.
 * @returns An unknown outcome containing the reason and any supplied request context.
 */
export function blackForestLabsUnknownOutcome(
  reason: "timeout" | "transport" | "provider-error" | "indeterminate",
  providerRequestId: string | undefined,
  requestEvidence: ProviderRequestEvidence | undefined,
): ReservedProviderOutcome<BlackForestLabsFlux2ProResult> {
  return {
    kind: "unknown",
    reason,
    ...(providerRequestId ? { providerRequestId } : {}),
    ...(requestEvidence ? { requestEvidence } : {}),
  };
}
