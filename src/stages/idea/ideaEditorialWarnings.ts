import { appendLedgerEvent } from "../../core/ledger.js";
import type { RunRecord } from "../../core/state.js";
import type { IdeaListEditorialWarning } from "../provider/providerIdeaListQuality.js";

/**
 * Records non-blocking idea-copy findings for operator review without weakening structural,
 * originality, language, or safety validation.
 */
export async function recordIdeaEditorialWarnings(
  run: RunRecord,
  warnings: readonly IdeaListEditorialWarning[],
): Promise<RunRecord> {
  if (warnings.length === 0) {
    return run;
  }
  const messages = warnings.map((warning) => warning.message);
  await appendLedgerEvent({
    runId: run.runId,
    type: "WARNING",
    stage: "ideas",
    message: "Idea slate has non-blocking editorial copy warnings; review before approval.",
    data: { warnings },
  });
  return { ...run, warnings: Array.from(new Set([...run.warnings, ...messages])) };
}
