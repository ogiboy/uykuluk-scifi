import { ProducerConfig } from "../config/schema";
import { RunRecord } from "../core/state";
import { requireApproval } from "../safeguards/approvalGuard";
import {
  blockPrivateUploadUnlessExplicitlyEnabled,
  blockPublicPublishUnlessExplicitlyEnabled,
} from "../safeguards/publishGuard";

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
