import { appendLedgerEvent } from "../core/ledger";
import { RunRecord } from "../core/state";
import { ProducerConfig } from "../config/schema";
import { SafeExitError } from "../core/errors";

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

export async function blockPublicPublishUnlessExplicitlyEnabled(
  run: RunRecord,
  config: ProducerConfig,
): Promise<void> {
  const stage = "publish";
  if (
    !config.providers.youtube.enabled ||
    !config.providers.youtube.allowPublicPublish ||
    config.safeguards.neverPublicPublishWithoutExplicitApproval
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
      },
    });
    throw new SafeExitError(
      "Publish is disabled by default and always requires explicit publish approval.",
    );
  }
}
