import { readFile } from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";
import {
  analyticsDatasetPath,
  analyticsReportPath,
  analyticsRunLinkTemplatePath,
} from "../../../../src/analytics/paths";
import { analyticsDatasetSchema, type AnalyticsRecord } from "../../../../src/analytics/schema";
import {
  currentReportStatus,
  emptyDataQuality,
  reportWarning,
  summarizeAnalyticsDataQuality,
  type StudioAnalyticsDataQuality,
  type StudioAnalyticsReportStatus,
} from "./analyticsQuality";
import { ArtifactJsonParseError, parseArtifactJson, readOptionalText } from "./localArtifactReads";
import { projectRoot } from "./projectRoot";

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
  runLinkTemplatePath: string;
  sourceFileName: string | null;
  sourceFormat: string | null;
  status: StudioAnalyticsStatus;
  topVideos: StudioAnalyticsTopVideo[];
  totalImpressions: number;
  totalViews: number;
  unmappedRecordCount: number;
};

/**
 * Loads the studio analytics dataset and report preview, then builds a summary overview.
 *
 * @returns The analytics overview, or a fallback overview when the dataset is missing or invalid.
 */
export async function getStudioAnalyticsOverview(): Promise<StudioAnalyticsOverview> {
  const root = projectRoot();
  const datasetPath = path.join(root, ...analyticsDatasetPath.split("/"));
  const reportPath = path.join(root, ...analyticsReportPath.split("/"));
  const report = await readOptionalText(reportPath, REPORT_PREVIEW_LIMIT);

  try {
    const rawDataset = await readFile(datasetPath, "utf8");
    const dataset = analyticsDatasetSchema.parse(
      parseArtifactJson(rawDataset, analyticsDatasetPath),
    );
    const reportStatus = currentReportStatus(dataset, report.text);
    const mappedRunIds = new Set(
      dataset.records
        .map((record) => record.runId)
        .filter((runId): runId is string => typeof runId === "string"),
    );

    return {
      datasetPath: analyticsDatasetPath,
      error: null,
      generatedAt: dataset.generatedAt,
      mappedRunCount: mappedRunIds.size,
      nextCommand: "pnpm producer analytics report",
      recordCount: dataset.records.length,
      reportPath: analyticsReportPath,
      reportPreview: report.text,
      reportPreviewTruncated: report.truncated,
      reportStatus,
      reportWarning: reportWarning(reportStatus),
      runLinkTemplatePath: analyticsRunLinkTemplatePath,
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

/**
 * Builds an analytics overview for a missing or invalid dataset.
 *
 * @param error - The error raised while reading or parsing the dataset
 * @param report - The optional report preview and truncation state
 * @returns A fallback overview with dataset-derived fields cleared and status set from the dataset error
 */
function missingOrInvalidOverview(
  error: unknown,
  report: { text: string | null; truncated: boolean },
): StudioAnalyticsOverview {
  const missingDataset = (error as NodeJS.ErrnoException).code === "ENOENT";
  return {
    datasetPath: analyticsDatasetPath,
    error: missingDataset ? null : invalidDatasetMessage(error),
    generatedAt: null,
    mappedRunCount: 0,
    nextCommand: "pnpm producer analytics import --file performance.csv",
    recordCount: 0,
    reportPath: analyticsReportPath,
    reportPreview: report.text,
    reportPreviewTruncated: report.truncated,
    reportStatus: report.text ? "stale" : "missing",
    reportWarning: report.text
      ? "Report artifact exists, but the analytics dataset is missing or invalid."
      : null,
    runLinkTemplatePath: analyticsRunLinkTemplatePath,
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

function invalidDatasetMessage(error: unknown): string {
  if (error instanceof ArtifactJsonParseError) {
    return "analytics/performance.json contains malformed JSON or a truncated write.";
  }
  if (error instanceof ZodError) {
    return "analytics/performance.json is missing required fields.";
  }
  return "analytics/performance.json could not be read.";
}

/**
 * Computes the top five videos by view count.
 *
 * @param records - Analytics records to rank
 * @returns The five videos with the highest view counts, ordered from highest to lowest
 */
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

/**
 * Sums a numeric field across a set of records.
 *
 * @param records - The records to aggregate
 * @param key - The record field to sum
 * @returns The sum of numeric values in `records` for `key`
 */
function sum(records: readonly AnalyticsRecord[], key: keyof AnalyticsRecord): number {
  return records.reduce((total, record) => {
    const value = record[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}
