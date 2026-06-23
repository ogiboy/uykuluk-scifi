import { appendLedgerEvent } from "../core/ledger.js";
import { RunRecord } from "../core/state.js";
import { ProducerConfig } from "../config/schema.js";
import { SafeExitError } from "../core/errors.js";

export async function blockPrivateUploadUnlessExplicitlyEnabled(
  run: RunRecord,
  config: ProducerConfig,
): Promise<void> {
  const stage = "upload";
  if (!config.providers.youtube.enabled || !config.providers.youtube.allowPrivateUpload) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage,
      message: "Private upload is disabled by configuration.",
      data: { youtube: config.providers.youtube },
    });
    throw new SafeExitError(
      "Upload is disabled by default. Enable private upload and record explicit upload approval first.",
    );
  }
}

/**
 * Enforces configuration safeguards for public YouTube publishing.
 *
 * Blocks publishing if YouTube is disabled, public publishing is disabled, or explicit publish approval is required but missing.
 *
 * @throws `SafeExitError` if publishing is blocked.
 */
export async function blockPublicPublishUnlessExplicitlyEnabled(
  run: RunRecord,
  config: ProducerConfig,
): Promise<void> {
  const stage = "publish";
  const hasExplicitApproval = run.approvals.some(
    (approval) => approval.runId === run.runId && approval.target === "publish",
  );
  if (
    !config.providers.youtube.enabled ||
    !config.providers.youtube.allowPublicPublish ||
    (config.safeguards.neverPublicPublishWithoutExplicitApproval && !hasExplicitApproval)
  ) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "GUARD_BLOCKED",
      stage,
      message: "Public or scheduled publish is disabled or requires explicit approval.",
      data: {
        youtube: config.providers.youtube,
        neverPublicPublishWithoutExplicitApproval:
          config.safeguards.neverPublicPublishWithoutExplicitApproval,
        hasExplicitApproval,
      },
    });
    throw new SafeExitError(
      "Publish is disabled by default and always requires explicit publish approval.",
    );
  }
}
