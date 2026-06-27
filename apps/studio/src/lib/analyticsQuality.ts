import {
  emptyAnalyticsDataQuality,
  summarizeAnalyticsDataQuality,
  type AnalyticsDataQualitySummary,
} from "../../../../src/analytics/dataQuality";

export type StudioAnalyticsReportStatus = "current" | "missing" | "stale";

export type StudioAnalyticsDataQuality = AnalyticsDataQualitySummary;

export { summarizeAnalyticsDataQuality };

export function emptyDataQuality(): StudioAnalyticsDataQuality {
  return emptyAnalyticsDataQuality();
}

export function currentReportStatus(
  dataset: { generatedAt: string; source: { sha256: string } },
  reportText: string | null,
): StudioAnalyticsReportStatus {
  if (!reportText) {
    return "missing";
  }
  return reportText.includes(`Generated: ${dataset.generatedAt}`) &&
    reportText.includes(dataset.source.sha256)
    ? "current"
    : "stale";
}

export function reportWarning(status: StudioAnalyticsReportStatus): string | null {
  if (status === "current") {
    return null;
  }
  return status === "missing"
    ? "Report artifact is missing. Refresh it from the current dataset before review."
    : "Report artifact does not match the current dataset. Refresh it before review.";
}
