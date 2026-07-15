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
