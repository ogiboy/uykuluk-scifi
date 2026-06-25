import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyticsRecordConfidence } from "../../../../src/analytics/recommendations";
import { analyticsDatasetSchema, type AnalyticsRecord } from "../../../../src/analytics/schema";
import { projectRoot } from "./projectRoot";

const ANALYTICS_DATASET_PATH = "analytics/performance.json";
const ANALYTICS_REPORT_PATH = "analytics/performance_report.md";
const REPORT_PREVIEW_LIMIT = 3_000;

export type StudioAnalyticsStatus = "invalid" | "missing" | "ready";

export type StudioAnalyticsTopVideo = {
  runId: string | null;
  title: string;
  videoId: string;
  views: number;
};

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

export type StudioAnalyticsOverview = {
  dataQuality: StudioAnalyticsDataQuality;
  datasetPath: string;
  error: string | null;
  generatedAt: string | null;
  mappedRunCount: number;
  nextCommand: string;
  recordCount: number;
  reportPath: string;
  reportPreview: string | null;
  reportPreviewTruncated: boolean;
  sourceFileName: string | null;
  sourceFormat: string | null;
  status: StudioAnalyticsStatus;
  topVideos: StudioAnalyticsTopVideo[];
  totalImpressions: number;
  totalViews: number;
  unmappedRecordCount: number;
};

export async function getStudioAnalyticsOverview(): Promise<StudioAnalyticsOverview> {
  const root = projectRoot();
  const datasetPath = path.join(root, ...ANALYTICS_DATASET_PATH.split("/"));
  const reportPath = path.join(root, ...ANALYTICS_REPORT_PATH.split("/"));
  const report = await readOptionalText(reportPath, REPORT_PREVIEW_LIMIT);

  try {
    const rawDataset = await readFile(datasetPath, "utf8");
    const dataset = analyticsDatasetSchema.parse(JSON.parse(rawDataset));
    const mappedRunIds = new Set(
      dataset.records
        .map((record) => record.runId)
        .filter((runId): runId is string => typeof runId === "string"),
    );

    return {
      datasetPath: ANALYTICS_DATASET_PATH,
      error: null,
      generatedAt: dataset.generatedAt,
      mappedRunCount: mappedRunIds.size,
      nextCommand: "pnpm producer analytics report",
      recordCount: dataset.records.length,
      reportPath: ANALYTICS_REPORT_PATH,
      reportPreview: report.text,
      reportPreviewTruncated: report.truncated,
      sourceFileName: dataset.source.fileName,
      sourceFormat: dataset.source.format,
      status: "ready",
      dataQuality: dataQuality(dataset.records),
      topVideos: topVideos(dataset.records),
      totalImpressions: sum(dataset.records, "impressions"),
      totalViews: sum(dataset.records, "views"),
      unmappedRecordCount: dataset.records.filter((record) => !record.runId).length,
    };
  } catch (error) {
    return missingOrInvalidOverview(error, report);
  }
}

async function readOptionalText(
  target: string,
  characterLimit: number,
): Promise<{ text: string | null; truncated: boolean }> {
  try {
    const content = await readFile(target, "utf8");
    return {
      text: content.slice(0, characterLimit),
      truncated: content.length > characterLimit,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { text: null, truncated: false };
    }
    throw error;
  }
}

function missingOrInvalidOverview(
  error: unknown,
  report: { text: string | null; truncated: boolean },
): StudioAnalyticsOverview {
  const missingDataset = (error as NodeJS.ErrnoException).code === "ENOENT";
  return {
    datasetPath: ANALYTICS_DATASET_PATH,
    error: missingDataset ? null : "analytics/performance.json is missing required fields.",
    generatedAt: null,
    mappedRunCount: 0,
    nextCommand: "pnpm producer analytics import --file performance.csv",
    recordCount: 0,
    reportPath: ANALYTICS_REPORT_PATH,
    reportPreview: report.text,
    reportPreviewTruncated: report.truncated,
    sourceFileName: null,
    sourceFormat: null,
    status: missingDataset ? "missing" : "invalid",
    dataQuality: emptyDataQuality(),
    topVideos: [],
    totalImpressions: 0,
    totalViews: 0,
    unmappedRecordCount: 0,
  };
}

function dataQuality(records: readonly AnalyticsRecord[]): StudioAnalyticsDataQuality {
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

function emptyDataQuality(): StudioAnalyticsDataQuality {
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

function missingCount(records: readonly AnalyticsRecord[], key: keyof AnalyticsRecord): number {
  return records.filter((record) => record[key] === undefined).length;
}

function topVideos(records: readonly AnalyticsRecord[]): StudioAnalyticsTopVideo[] {
  return [...records]
    .sort((first, second) => (second.views ?? 0) - (first.views ?? 0))
    .slice(0, 5)
    .map((record) => ({
      runId: record.runId ?? null,
      title: record.title ?? record.videoId,
      videoId: record.videoId,
      views: record.views ?? 0,
    }));
}

function sum(records: readonly AnalyticsRecord[], key: keyof AnalyticsRecord): number {
  return records.reduce((total, record) => {
    const value = record[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}
