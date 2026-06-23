import { loadConfig } from "../config/config.js";
import { loadRun } from "../core/runStore.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { SafeExitError } from "../core/errors.js";
import { requireApproval } from "../safeguards/approvalGuard.js";
import { runPrivateUploadPlaceholder, runPublishPlaceholder } from "../youtube/uploadDisabled.js";

export async function renderPlaceholder(runId: string): Promise<never> {
  const run = await loadRun(runId);
  await requireApproval(run, "render", "render");
  await appendLedgerEvent({
    runId: run.runId,
    type: "GUARD_BLOCKED",
    stage: "render",
    message: "Render is scaffolded only in the MVP.",
  });
  throw new SafeExitError("Render is scaffolded only and remains approval-gated.");
}

export async function uploadPrivatePlaceholder(runId: string): Promise<never> {
  const config = await loadConfig();
  const run = await loadRun(runId);
  return runPrivateUploadPlaceholder(run, config);
}

export async function publishSchedulePlaceholder(runId: string): Promise<never> {
  const config = await loadConfig();
  const run = await loadRun(runId);
  return runPublishPlaceholder(run, config);
}
