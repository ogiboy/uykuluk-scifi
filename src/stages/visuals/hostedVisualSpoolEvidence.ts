import { SafeExitError } from "../../core/errors.js";
import type { CostReservationSummary } from "../../costs/costReservationStore.js";
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

export function requireHostedVisualResultDigest(value: string | undefined): string {
  if (!value) {
    throw new SafeExitError("Settled hosted visual operation is missing its result digest.");
  }
  return value;
}
