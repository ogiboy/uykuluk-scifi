import {
  emptyAnalyticsDataQuality,
  type AnalyticsDataQualitySummary,
} from "../../../../src/analytics/dataQuality";
export { summarizeAnalyticsDataQuality } from "../../../../src/analytics/dataQuality";

export type StudioAnalyticsReportStatus = "current" | "missing" | "stale";

export type StudioAnalyticsDataQuality = AnalyticsDataQualitySummary;

/**
 * Returns an empty studio analytics data quality summary.
 *
 * @returns An empty `StudioAnalyticsDataQuality` value
 */
export function emptyDataQuality(): StudioAnalyticsDataQuality {
  return emptyAnalyticsDataQuality();
}

/**
 * Determines the status of an analytics report for a dataset.
 *
 * @param dataset - The dataset metadata to compare against.
 * @param reportText - The report content to inspect.
 * @returns `"missing"` if `reportText` is empty or null, `"current"` if it matches the dataset, `"stale"` otherwise.
 */
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

/**
 * Gets the review warning for a report status.
 *
 * @param status - The report status
 * @returns `null` when the report is current; otherwise, a warning message for a missing or stale report
 */
export function reportWarning(status: StudioAnalyticsReportStatus): string | null {
  if (status === "current") {
    return null;
  }
  return status === "missing"
    ? "Report artifact is missing. Refresh it from the current dataset before review."
    : "Report artifact does not match the current dataset. Refresh it before review.";
}
