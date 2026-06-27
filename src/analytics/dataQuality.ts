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

/**
 * Summarizes analytics data quality across a set of records.
 *
 * Counts record confidence levels, missing-field totals, and the next recommended data-quality action.
 *
 * @param records - The analytics records to summarize
 * @returns The aggregated data-quality summary
 */
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

/**
 * Determines the confidence level for an analytics record.
 *
 * @param record - The analytics record to assess
 * @returns The record confidence details and level
 */
export function analyticsRecordConfidence(
  record: AnalyticsDataQualityRecord,
): AnalyticsRecordConfidence {
  const missing = [
    record.runId ? null : "run link",
    record.views === undefined ? "views" : null,
    record.impressions === undefined ? "impressions" : null,
    record.ctr === undefined ? "CTR" : null,
    record.averagePercentageViewed === undefined ? "retention" : null,
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

/**
 * Creates an empty analytics data-quality summary.
 *
 * @returns A summary with all counts set to `0` and a default next-step instruction.
 */
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

/**
 * Chooses the next data-quality action from the current record and missing-field counts.
 *
 * @param counts - Aggregated counts for missing analytics fields and total records.
 * @returns A guidance message for the next data-quality step.
 */
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

/**
 * Maps a present-field count to a confidence level.
 *
 * @param presentCount - The number of required fields that are present.
 * @returns `"high"` for five or more present fields, `"medium"` for three or four, and `"low"` otherwise.
 */
function confidenceLevel(presentCount: number): AnalyticsRecordConfidence["level"] {
  if (presentCount >= 5) {
    return "high";
  }
  if (presentCount >= 3) {
    return "medium";
  }
  return "low";
}

/**
 * Determines whether a value is a string.
 *
 * @param value - The value to test.
 * @returns `true` if `value` is a string, `false` otherwise.
 */
function isString(value: string | null): value is string {
  return value !== null;
}

/**
 * Counts records missing a specific field.
 *
 * @param records - The records to inspect
 * @param key - The field to check for `undefined`
 * @returns The number of records whose value for `key` is `undefined`
 */
function missingCount(
  records: readonly AnalyticsDataQualityRecord[],
  key: keyof AnalyticsDataQualityRecord,
): number {
  return records.filter((record) => record[key] === undefined).length;
}
