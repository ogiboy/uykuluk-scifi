import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyticsDatasetSchema, type AnalyticsRecord } from "../../../../src/analytics/schema";
import {
  currentReportStatus,
  emptyDataQuality,
  reportWarning,
  summarizeAnalyticsDataQuality,
  type StudioAnalyticsDataQuality,
  type StudioAnalyticsReportStatus,
} from "./analyticsQuality";
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
  reportStatus: StudioAnalyticsReportStatus;
  reportPreviewTruncated: boolean;
  reportWarning: string | null;
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
    const reportStatus = currentReportStatus(dataset, report.text);
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
      reportStatus,
      reportWarning: reportWarning(reportStatus),
      sourceFileName: dataset.source.fileName,
      sourceFormat: dataset.source.format,
      status: "ready",
      dataQuality: summarizeAnalyticsDataQuality(dataset.records),
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
    reportStatus: report.text ? "stale" : "missing",
    reportWarning: report.text
      ? "Report artifact exists, but the analytics dataset is missing or invalid."
      : null,
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
