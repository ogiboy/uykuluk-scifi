import { analyticsRecordConfidence } from "../../../../src/analytics/recommendations";
import type { AnalyticsRecord } from "../../../../src/analytics/schema";

export type StudioAnalyticsReportStatus = "current" | "missing" | "stale";

export type StudioAnalyticsDataQuality = {
  highConfidenceRecordCount: number;
  lowConfidenceRecordCount: number;
  mediumConfidenceRecordCount: number;
  missingCtrCount: number;
  missingImpressionsCount: number;
  missingRetentionCount: number;
  missingRunLinkCount: number;
  missingViewsCount: number;
  nextDataQualityAction: string;
};

export function summarizeAnalyticsDataQuality(
  records: readonly AnalyticsRecord[],
): StudioAnalyticsDataQuality {
  const confidenceCounts = { high: 0, low: 0, medium: 0 };
  for (const record of records) {
    confidenceCounts[analyticsRecordConfidence(record).level] += 1;
  }
  const missingRunLinkCount = records.filter((record) => !record.runId).length;
  const missingCtrCount = missingCount(records, "ctr");
  const missingImpressionsCount = missingCount(records, "impressions");
  const missingRetentionCount = missingCount(records, "averagePercentageViewed");
  const missingViewsCount = missingCount(records, "views");
  return {
    highConfidenceRecordCount: confidenceCounts.high,
    lowConfidenceRecordCount: confidenceCounts.low,
    mediumConfidenceRecordCount: confidenceCounts.medium,
    missingCtrCount,
    missingImpressionsCount,
    missingRetentionCount,
    missingRunLinkCount,
    missingViewsCount,
    nextDataQualityAction: nextDataQualityAction({
      missingCtrCount,
      missingImpressionsCount,
      missingRetentionCount,
      missingRunLinkCount,
      missingViewsCount,
      recordCount: records.length,
    }),
  };
}

export function emptyDataQuality(): StudioAnalyticsDataQuality {
  return {
    highConfidenceRecordCount: 0,
    lowConfidenceRecordCount: 0,
    mediumConfidenceRecordCount: 0,
    missingCtrCount: 0,
    missingImpressionsCount: 0,
    missingRetentionCount: 0,
    missingRunLinkCount: 0,
    missingViewsCount: 0,
    nextDataQualityAction:
      "Import performance records with run_id, views, impressions, CTR, and retention.",
  };
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

function nextDataQualityAction(counts: {
  missingCtrCount: number;
  missingImpressionsCount: number;
  missingRetentionCount: number;
  missingRunLinkCount: number;
  missingViewsCount: number;
  recordCount: number;
}): string {
  if (counts.recordCount === 0) {
    return "Import performance records with run_id, views, impressions, CTR, and retention.";
  }
  if (counts.missingRunLinkCount > 0) {
    return "Add run_id values before comparing imported videos back to producer runs.";
  }
  if (
    counts.missingCtrCount > 0 ||
    counts.missingImpressionsCount > 0 ||
    counts.missingRetentionCount > 0 ||
    counts.missingViewsCount > 0
  ) {
    return "Include views, impressions, CTR, and retention before acting on recommendations.";
  }
  return "Review recommendations as non-causal prompts and keep the next experiment small.";
}

function missingCount(records: readonly AnalyticsRecord[], key: keyof AnalyticsRecord): number {
  return records.filter((record) => record[key] === undefined).length;
}
