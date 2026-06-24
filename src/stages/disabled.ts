import { loadConfig } from "../config/config.js";
import { loadRun } from "../core/runStore.js";
import { runPrivateUploadPlaceholder, runPublishPlaceholder } from "../youtube/uploadDisabled.js";

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
