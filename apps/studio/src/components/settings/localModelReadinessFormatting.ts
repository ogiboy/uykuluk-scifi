import type { StudioLocale } from "@/i18n/locales";
import type { StudioLocalModelOverview } from "@/lib/localModels/localModelOverview";
import type { LocalModelCopy } from "./localModelReadinessCopy";

export function nextLocalModelOperation(
  readiness: StudioLocalModelOverview["readiness"],
): "setup" | "verify" {
  return readiness === "ready" ? "verify" : "setup";
}

export function formatLocalModelBytes(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export function formatLocalModelDuration(seconds: number, locale: StudioLocale): string {
  const minutes = Math.ceil(seconds / 60);
  return locale === "tr" ? `yaklaşık ${minutes} dk.` : `about ${minutes} min`;
}

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
