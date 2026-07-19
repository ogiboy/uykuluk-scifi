import type { StudioLocale } from "@/i18n/locales";
import type { StudioLocalModelOverview } from "@/lib/localModels/localModelOverview";
import type { LocalModelCopy } from "./localModelReadinessCopy";

/**
 * Selects the next operation for the local model workflow.
 *
 * @param readiness - The current local model readiness state
 * @returns `verify` when the model is ready, `setup` otherwise
 */
export function nextLocalModelOperation(
  readiness: StudioLocalModelOverview["readiness"],
): "setup" | "verify" {
  return readiness === "ready" ? "verify" : "setup";
}

export function formatLocalModelBytes(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/**
 * Formats an estimated duration in minutes for the specified locale.
 *
 * @param seconds - The estimated duration in seconds
 * @param locale - The locale used for the formatted text
 * @returns A localized approximate duration in minutes
 */
export function formatLocalModelDuration(seconds: number, locale: StudioLocale): string {
  const minutes = Math.ceil(seconds / 60);
  return locale === "tr" ? `yaklaşık ${minutes} dk.` : `about ${minutes} min`;
}

/**
 * Formats the elapsed time since a local model operation started.
 *
 * @param startedAt - The operation start timestamp
 * @param locale - The locale used for the duration text
 * @param now - The timestamp used as the current time
 * @returns A localized elapsed-time string, or `undefined` when the start timestamp is missing, invalid, or in the future
 */
export function formatLocalModelElapsed(
  startedAt: string | undefined,
  locale: StudioLocale,
  now = Date.now(),
): string | undefined {
  if (!startedAt) return undefined;
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started) || started > now) return undefined;
  const totalSeconds = Math.max(0, Math.floor((now - started) / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (locale === "tr") return minutes > 0 ? `${minutes} dk. ${seconds} sn.` : `${seconds} sn.`;
  return minutes > 0 ? `${minutes} min ${seconds} sec` : `${seconds} sec`;
}

/**
 * Selects the localized label for the local model's current progress or readiness state.
 *
 * @param copy - Localized label text for each model state
 * @param overview - The model's progress phase and readiness state
 * @returns The label corresponding to the active progress or readiness state
 */
export function localModelReadinessLabel(
  copy: LocalModelCopy,
  overview: Pick<StudioLocalModelOverview, "progress" | "readiness">,
): string {
  const phase = overview.progress?.phase;
  if (phase === "downloading-model") return copy.downloading;
  if (phase === "setting-up") return copy.installing;
  if (phase === "verifying") return copy.verifying;
  if (overview.readiness === "setup-running") return copy.installing;
  if (overview.readiness === "setup-pending") return copy.queued;
  if (overview.readiness === "ready") return copy.ready;
  if (overview.readiness === "interrupted") return copy.interrupted;
  if (overview.readiness === "failed") return copy.failed;
  return copy.notInstalled;
}

/**
 * Selects guidance text for the current local model readiness state.
 *
 * @param copy - Localized guidance strings for each readiness state
 * @param readiness - The current local model readiness state
 * @returns The guidance string corresponding to `readiness`
 */
export function localModelReadinessGuidance(
  copy: LocalModelCopy,
  readiness: StudioLocalModelOverview["readiness"],
): string {
  if (readiness === "setup-running") return copy.runningGuidance;
  if (readiness === "setup-pending") return copy.queuedGuidance;
  if (readiness === "ready") return copy.readyGuidance;
  if (readiness === "interrupted") return copy.interruptedGuidance;
  if (readiness === "failed") return copy.failedGuidance;
  return copy.notInstalledGuidance;
}
