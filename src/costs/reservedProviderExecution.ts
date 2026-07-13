import { z } from "zod";
import { sha256 } from "../utils/hash.js";
import {
  beginCostReservationExecution,
  releaseDefinitelyNotSentExecution,
} from "./costReservationExecutionState.js";
import {
  markCostReservationUncertain,
  reserveApprovedCost,
  settleCostReservation,
} from "./costReservationService.js";
import { CostReservationSummary } from "./costReservationStore.js";
import {
  providerAdapterIdentitySchema,
  type ProviderAdapterIdentity,
} from "./providerAdapterIdentity.js";
import {
  providerRequestEvidenceSchema,
  type ProviderRequestEvidence,
} from "./providerRequestEvidence.js";

const timeoutSchema = z.int().positive().max(600_000);
const providerRequestIdSchema = z.string().min(1).max(256);
const providerOutcomeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("success"),
    value: z.unknown(),
    actualUsdMicros: z.int().nonnegative(),
    inputTokens: z.int().nonnegative().optional(),
    outputTokens: z.int().nonnegative().optional(),
    durationMs: z.int().nonnegative().optional(),
    providerRequestId: providerRequestIdSchema.optional(),
    resultEvidenceDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.strictObject({
    kind: z.literal("definitely-not-sent"),
    reason: z.enum(["adapter-validation", "cancelled-before-send", "connection-not-opened"]),
  }),
  z.strictObject({
    kind: z.literal("unknown"),
    reason: z.enum(["timeout", "transport", "provider-error", "indeterminate"]),
    providerRequestId: providerRequestIdSchema.optional(),
    requestEvidence: providerRequestEvidenceSchema.optional(),
  }),
]);

export type ReservedProviderCallContext = {
  reservationId: string;
  operationId: string;
  provider: string;
  model?: string;
  bindingDigest?: string;
  maxUsdMicros: number;
  signal: AbortSignal;
};

export type ReservedProviderOutcome<T> =
  | {
      kind: "success";
      value: T;
      actualUsdMicros: number;
      inputTokens?: number;
      outputTokens?: number;
      durationMs?: number;
      providerRequestId?: string;
      resultEvidenceDigest?: string;
    }
  | {
      kind: "definitely-not-sent";
      reason: "adapter-validation" | "cancelled-before-send" | "connection-not-opened";
    }
  | {
      kind: "unknown";
      reason: "timeout" | "transport" | "provider-error" | "indeterminate";
      providerRequestId?: string;
      requestEvidence?: ProviderRequestEvidence;
    };

export type ReservedProviderAdapter<T> = ProviderAdapterIdentity & {
  execute(context: ReservedProviderCallContext): Promise<ReservedProviderOutcome<T>>;
};

export type ReservedProviderExecutionResult<T> =
  | { status: "completed"; value: T; reservation: CostReservationSummary }
  | { status: "already-completed"; reservation: CostReservationSummary }
  | { status: "definitely-not-sent"; reservation: CostReservationSummary }
  | { status: "reconciliation-required"; reservation: CostReservationSummary };

/**
 * Executes an approved provider operation with reservation tracking and outcome-specific reconciliation.
 *
 * @param input - Operation identifiers, execution timeout, provider adapter, and optional post-execution callback.
 * @returns A result indicating whether the operation completed, was definitely not sent, requires reconciliation, or was already terminal, including the associated reservation and completed value when applicable.
 */
export async function executeReservedProviderOperation<T>(input: {
  runId: string;
  stage: string;
  operationId: string;
  timeoutMs: number;
  adapter: ReservedProviderAdapter<T>;
  afterSuccessfulExecutionCommitted?: () => Promise<void>;
}): Promise<ReservedProviderExecutionResult<T>> {
  const timeoutMs = timeoutSchema.parse(input.timeoutMs);
  const adapterIdentity = providerAdapterIdentitySchema.parse({
    provider: input.adapter.provider,
    model: input.adapter.model,
    ...(input.adapter.bindingDigest ? { bindingDigest: input.adapter.bindingDigest } : {}),
  });
  const reservation = await reserveApprovedCost({
    runId: input.runId,
    stage: input.stage,
    operationId: input.operationId,
    adapterIdentity,
  });
  const claim = await beginCostReservationExecution({
    runId: input.runId,
    reservationId: reservation.reservationId,
    adapterIdentity,
  });
  if (!claim.started) {
    return terminalExecutionResult(claim.reservation);
  }

  const outcome = await invokeAdapter(input.adapter, claim.reservation, timeoutMs);
  if (outcome.kind === "definitely-not-sent") {
    return {
      status: "definitely-not-sent",
      reservation: await releaseDefinitelyNotSentExecution({
        runId: input.runId,
        reservationId: reservation.reservationId,
        adapterIdentity,
        reason: outcome.reason,
      }),
    };
  }
  if (outcome.kind === "unknown") {
    return {
      status: "reconciliation-required",
      reservation: await markCostReservationUncertain({
        runId: input.runId,
        reservationId: reservation.reservationId,
        reason: `Provider execution outcome is unknown (${outcome.reason}).`,
        providerRequestIdHash: hashProviderRequestId(outcome.providerRequestId),
        requestEvidence: outcome.requestEvidence,
      }),
    };
  }
  await input.afterSuccessfulExecutionCommitted?.();
  return {
    status: "completed",
    value: outcome.value as T,
    reservation: await settleCostReservation({
      runId: input.runId,
      reservationId: reservation.reservationId,
      actualUsdMicros: outcome.actualUsdMicros,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      durationMs: outcome.durationMs,
      providerRequestIdHash: hashProviderRequestId(outcome.providerRequestId),
      resultEvidenceDigest: outcome.resultEvidenceDigest,
    }),
  };
}

/**
 * Executes a provider adapter within a time limit and normalizes its outcome.
 *
 * @param adapter - The provider adapter to execute.
 * @param reservation - Reservation details supplied to the adapter.
 * @param timeoutMs - Maximum time allowed for adapter execution.
 * @returns The validated provider outcome, including elapsed duration for successful outcomes.
 */
async function invokeAdapter<T>(
  adapter: ReservedProviderAdapter<T>,
  reservation: CostReservationSummary,
  timeoutMs: number,
): Promise<z.infer<typeof providerOutcomeSchema>> {
  const controller = new AbortController();
  const startedAt = Date.now();
  let timer: NodeJS.Timeout | undefined;
  let timedOut = false;
  try {
    const raw = await Promise.race([
      adapter.execute({
        reservationId: reservation.reservationId,
        operationId: reservation.operationId,
        provider: reservation.provider,
        model: reservation.model,
        ...(reservation.bindingDigest ? { bindingDigest: reservation.bindingDigest } : {}),
        maxUsdMicros: reservation.maxUsdMicros,
        signal: controller.signal,
      }),
      new Promise<ReservedProviderOutcome<T>>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve({ kind: "unknown", reason: "timeout" });
          controller.abort();
        }, timeoutMs);
      }),
    ]);
    if (timedOut) {
      return { kind: "unknown", reason: "timeout" };
    }
    const outcome = providerOutcomeSchema.parse(raw);
    if (outcome.kind === "success") {
      return { ...outcome, durationMs: Date.now() - startedAt };
    }
    return outcome;
  } catch {
    return { kind: "unknown", reason: "indeterminate" };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function hashProviderRequestId(providerRequestId: string | undefined): string | undefined {
  return providerRequestId ? sha256(providerRequestId) : undefined;
}

function terminalExecutionResult<T>(
  reservation: CostReservationSummary,
): ReservedProviderExecutionResult<T> {
  switch (reservation.status) {
    case "SETTLED":
      return { status: "already-completed", reservation };
    case "RELEASED":
      return { status: "definitely-not-sent", reservation };
    default:
      return { status: "reconciliation-required", reservation };
  }
}
