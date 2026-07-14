import { createId, nowIso } from "../utils/time.js";
import { SafeExitError } from "./errors.js";
import { appendPreparedLedgerEvent } from "./ledger.js";
import { mutateRun } from "./runStore.js";
import { ledgerEventSchema, type LedgerEventType, type RunRecord } from "./state.js";

type RunLedgerIntentInput = Readonly<{
  data?: unknown;
  message: string;
  stage: string;
  type: LedgerEventType;
}>;

/** Adds a durable, fixed-identity ledger intent to the run mutation being committed. */
export function queueRunLedgerEvent(run: RunRecord, input: RunLedgerIntentInput): RunRecord {
  const event = ledgerEventSchema.parse({
    eventId: createId("evt"),
    runId: run.runId,
    type: input.type,
    stage: input.stage,
    message: input.message,
    data: input.data,
    createdAt: nowIso(),
  });
  return { ...run, pendingLedgerEvents: [...(run.pendingLedgerEvents ?? []), event] };
}

/** Flushes committed ledger intents idempotently and clears them only after every append succeeds. */
export async function reconcileRunLedgerOutbox(
  runId: string,
  options: Readonly<{ afterAppend?: () => Promise<void> }> = {},
): Promise<number> {
  const result = await mutateRun(runId, async (run) => {
    const pending = run.pendingLedgerEvents ?? [];
    if (pending.length === 0) return { run, value: 0, persist: false };
    for (const event of pending) {
      if (event.runId !== run.runId) {
        throw new SafeExitError("Pending ledger event identity does not match its owning run.");
      }
      await appendPreparedLedgerEvent(event);
    }
    await options.afterAppend?.();
    const { pendingLedgerEvents: _pendingLedgerEvents, ...cleared } = run;
    return { run: cleared, value: pending.length };
  });
  return result.value;
}
