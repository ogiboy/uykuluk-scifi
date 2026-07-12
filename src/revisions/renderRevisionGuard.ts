import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";

export async function blockRenderRevision(runId: string, message: string): Promise<never> {
  await appendLedgerEvent({ runId, type: "GUARD_BLOCKED", stage: "revise-render", message });
  throw new SafeExitError(`Blocked: ${message}`);
}
