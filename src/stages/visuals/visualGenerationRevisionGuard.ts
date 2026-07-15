import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";

export async function hostedVisualRevisionBlocked(
  runId: string,
  message: string,
): Promise<SafeExitError> {
  await appendLedgerEvent({
    runId,
    type: "GUARD_BLOCKED",
    stage: "visuals-hosted-reopen",
    message,
  });
  return new SafeExitError(message);
}
