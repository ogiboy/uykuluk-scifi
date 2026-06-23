import { ProducerConfig } from "../config/schema.js";
import { RunRecord } from "../core/state.js";
import { requireApproval } from "../safeguards/approvalGuard.js";
import {
  blockPrivateUploadUnlessExplicitlyEnabled,
  blockPublicPublishUnlessExplicitlyEnabled,
} from "../safeguards/publishGuard.js";

export async function runPrivateUploadPlaceholder(
  run: RunRecord,
  config: ProducerConfig,
): Promise<never> {
  await requireApproval(run, "upload", "upload");
  await blockPrivateUploadUnlessExplicitlyEnabled(run, config);
  throw new Error("Private upload implementation is intentionally disabled in MVP.");
}

export async function runPublishPlaceholder(
  run: RunRecord,
  config: ProducerConfig,
): Promise<never> {
  await requireApproval(run, "publish", "publish");
  await blockPublicPublishUnlessExplicitlyEnabled(run, config);
  throw new Error("Public or scheduled publish implementation is intentionally disabled in MVP.");
}
