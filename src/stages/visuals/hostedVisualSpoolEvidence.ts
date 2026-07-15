import { SafeExitError } from "../../core/errors.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
import type { VisualRevision } from "./visualContracts.js";
import type { LoadedHostedVisualGenerationSpool } from "./visualGenerationSpool.js";

type ExactHostedVisualSpoolIdentity = Readonly<{
  approvedQuote: { approvalId: string; quoteDigest: string };
  planDigest: string;
  reservation: CostReservationSummary;
  spool: LoadedHostedVisualGenerationSpool;
}>;

/** Verifies a committed spool against either pending or completed durable settlement evidence. */
export function requireCommittedHostedVisualSpool(
  input: ExactHostedVisualSpoolIdentity,
): LoadedHostedVisualGenerationSpool {
  const actualUsdMicros = input.reservation.actualUsdMicros;
  if (
    !["SETTLEMENT_PENDING", "SETTLED"].includes(input.reservation.status) ||
    actualUsdMicros === undefined
  ) {
    throw new SafeExitError("Hosted visual provider result is not durably committed.");
  }
  if (
    input.spool.spool.plan.digest !== input.planDigest ||
    input.spool.spool.approvedQuote.approvalId !== input.approvedQuote.approvalId ||
    input.spool.spool.approvedQuote.quoteDigest !== input.approvedQuote.quoteDigest ||
    input.spool.spool.reservationId !== input.reservation.reservationId ||
    input.spool.spool.actualUsdMicros !== actualUsdMicros ||
    input.spool.spool.providerRequestIdHash !== input.reservation.providerRequestIdHash ||
    input.spool.reference.digest !==
      requireHostedVisualResultDigest(input.reservation.resultEvidenceDigest)
  ) {
    throw new SafeExitError(
      "Committed hosted visual operation does not match its durable result spool.",
    );
  }
  return input.spool;
}

/** Verifies that a committed hosted visual spool also has final settled cost evidence. */
export function requireSettledHostedVisualSpool(
  input: ExactHostedVisualSpoolIdentity,
): LoadedHostedVisualGenerationSpool {
  if (input.reservation.status !== "SETTLED") {
    throw new SafeExitError("Hosted visual settlement is not durably complete.");
  }
  return requireCommittedHostedVisualSpool(input);
}

/** Verifies one manifest revision against its exact settled batch image evidence. */
export function requireHostedVisualSceneSpoolMatch(input: {
  sceneIndex: number;
  revision: VisualRevision;
  reservation: CostReservationSummary;
  spool: LoadedHostedVisualGenerationSpool;
}): void {
  const source = input.revision.source;
  if (input.revision.provider !== "black-forest-labs" || source.kind !== "hosted-generation") {
    throw new SafeExitError(`Hosted visual scene ${input.sceneIndex} has no hosted revision.`);
  }
  requireSettledHostedVisualSpool({
    spool: input.spool,
    reservation: input.reservation,
    planDigest: source.planDigest,
    approvedQuote: { approvalId: source.approvalId, quoteDigest: source.quoteDigest },
  });
  const images = input.spool.spool.images.filter((image) => image.sceneIndex === input.sceneIndex);
  const image = images[0];
  if (
    images.length !== 1 ||
    !image ||
    source.operationId !== input.spool.spool.operationId ||
    source.reservationId !== input.reservation.reservationId ||
    source.resultSpool.path !== input.spool.reference.path ||
    source.resultSpool.digest !== input.spool.reference.digest ||
    source.service !== input.spool.spool.provider.service ||
    source.modelId !== input.spool.spool.provider.modelId ||
    source.providerRequestIdHash !== image.providerRequest.requestIdHash ||
    source.billableCredits !== image.billing.billableCredits ||
    source.actualUsdMicros !== image.billing.derivedUsdMicros ||
    input.revision.asset.path !== image.asset.path ||
    input.revision.asset.digest !== image.asset.sha256 ||
    input.revision.media?.bytes !== image.media.bytes ||
    input.revision.media.format !== image.media.format ||
    input.revision.media.height !== image.media.height ||
    input.revision.media.width !== image.media.width
  ) {
    throw new SafeExitError(
      `Hosted visual scene ${input.sceneIndex} does not match its settled spool image.`,
    );
  }
}

export function requireHostedVisualResultDigest(value: string | undefined): string {
  if (!value) {
    throw new SafeExitError("Settled hosted visual operation is missing its result digest.");
  }
  return value;
}
