export type AnalyticsDataQualitySummary = {
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

export type AnalyticsRecordConfidence = {
  details: string;
  level: "high" | "low" | "medium";
};

type AnalyticsDataQualityRecord = {
  averagePercentageViewed?: number;
  ctr?: number;
  impressions?: number;
  runId?: string;
  views?: number;
};

export function summarizeAnalyticsDataQuality(
  records: readonly AnalyticsDataQualityRecord[],
): AnalyticsDataQualitySummary {
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

export function analyticsRecordConfidence(
  record: AnalyticsDataQualityRecord,
): AnalyticsRecordConfidence {
  const missing = [
    record.runId ? null : "run link",
    record.views !== undefined ? null : "views",
    record.impressions !== undefined ? null : "impressions",
    record.ctr !== undefined ? null : "CTR",
    record.averagePercentageViewed !== undefined ? null : "retention",
  ].filter(isString);
  const presentCount = 5 - missing.length;
  return {
    details:
      missing.length === 0
        ? "run-linked with views, impressions, CTR, and retention"
        : `missing ${missing.join(", ")}`,
    level: confidenceLevel(presentCount),
  };
}

export function emptyAnalyticsDataQuality(): AnalyticsDataQualitySummary {
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

function confidenceLevel(presentCount: number): AnalyticsRecordConfidence["level"] {
  if (presentCount >= 5) {
    return "high";
  }
  if (presentCount >= 3) {
    return "medium";
  }
  return "low";
}

function isString(value: string | null): value is string {
  return value !== null;
}

function missingCount(
  records: readonly AnalyticsDataQualityRecord[],
  key: keyof AnalyticsDataQualityRecord,
): number {
  return records.filter((record) => record[key] === undefined).length;
}
