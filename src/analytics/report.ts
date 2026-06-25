import { table } from "../utils/markdown.js";
import { renderAnalyticsRecommendations } from "./recommendations.js";
import type { AnalyticsDataset, AnalyticsRecord } from "./schema.js";

export function renderAnalyticsReport(dataset: AnalyticsDataset): string {
  const totals = summarize(dataset.records);
  const runSummaries = summarizeRuns(dataset.records);
  const unmappedCount = dataset.records.filter((record) => !record.runId).length;
  return [
    "# Manual Analytics Report",
    "",
    `Generated: ${dataset.generatedAt}`,
    `Source: ${dataset.source.fileName} (${dataset.source.format}, ${dataset.source.sha256})`,
    `Records: ${dataset.records.length} performance record(s)`,
    "",
    "> Operator-provided performance import. No causal claims are made from this import.",
    "",
    "## Summary",
    "",
    table(
      ["Metric", "Value"],
      [
        ["Views", formatInteger(totals.views)],
        ["Impressions", formatInteger(totals.impressions)],
        ["Weighted CTR", formatPercent(totals.weightedCtr)],
        ["Weighted average viewed", formatPercent(totals.weightedAverageViewed)],
        ["Average view duration", formatSeconds(totals.averageViewDurationSeconds)],
        ["Subscribers gained", formatInteger(totals.subscribersGained)],
        ["Mapped runs", formatInteger(runSummaries.length)],
        ["Unmapped records", formatInteger(unmappedCount)],
      ],
    ),
    "",
    "## Run Link Summary",
    "",
    table(
      ["Run", "Videos", "Views", "Weighted CTR", "Avg viewed", "Latest publish", "Top title"],
      runSummaryRows(runSummaries),
    ),
    "",
    "## Top Videos By Views",
    "",
    table(
      ["Video", "Run", "Views", "CTR", "Avg viewed"],
      [...dataset.records]
        .sort((left, right) => (right.views ?? 0) - (left.views ?? 0))
        .slice(0, 5)
        .map((record) => [
          tableCell(record.title ?? record.videoId),
          tableCell(record.runId ?? "unmapped"),
          formatInteger(record.views),
          formatPercent(record.ctr),
          formatPercent(record.averagePercentageViewed),
        ]),
    ),
    "",
    "## Non-Causal Recommendations",
    "",
    ...renderAnalyticsRecommendations(dataset.records),
  ].join("\n");
}

type RunSummary = {
  latestPublishedAt: string | undefined;
  recordCount: number;
  runId: string;
  topTitle: string;
  views: number;
  weightedAverageViewed: number | undefined;
  weightedCtr: number | undefined;
};

function summarize(records: AnalyticsRecord[]): {
  averageViewDurationSeconds: number | undefined;
  impressions: number;
  subscribersGained: number;
  views: number;
  weightedAverageViewed: number | undefined;
  weightedCtr: number | undefined;
} {
  const views = sum(records, "views");
  const impressions = sum(records, "impressions");
  return {
    averageViewDurationSeconds: weightedAverage(records, "averageViewDurationSeconds", "views"),
    impressions,
    subscribersGained: sum(records, "subscribersGained"),
    views,
    weightedAverageViewed: weightedAverage(records, "averagePercentageViewed", "views"),
    weightedCtr: weightedAverage(records, "ctr", "impressions"),
  };
}

function summarizeRuns(records: AnalyticsRecord[]): RunSummary[] {
  const groups = new Map<string, AnalyticsRecord[]>();
  for (const record of records) {
    if (!record.runId) {
      continue;
    }
    groups.set(record.runId, [...(groups.get(record.runId) ?? []), record]);
  }
  return [...groups.entries()]
    .map(([runId, runRecords]) => {
      const topRecord = [...runRecords].sort(
        (left, right) => (right.views ?? 0) - (left.views ?? 0),
      )[0];
      return {
        latestPublishedAt: latestPublishedAt(runRecords),
        recordCount: runRecords.length,
        runId,
        topTitle: topRecord?.title ?? topRecord?.videoId ?? "unknown",
        views: sum(runRecords, "views"),
        weightedAverageViewed: weightedAverage(runRecords, "averagePercentageViewed", "views"),
        weightedCtr: weightedAverage(runRecords, "ctr", "impressions"),
      };
    })
    .sort((left, right) => right.views - left.views);
}

function runSummaryRows(summaries: RunSummary[]): string[][] {
  if (summaries.length === 0) {
    return [["unmapped", "0", "0", "unknown", "unknown", "unknown", "No run IDs imported"]];
  }
  return summaries.map((summary) => [
    tableCell(summary.runId),
    formatInteger(summary.recordCount),
    formatInteger(summary.views),
    formatPercent(summary.weightedCtr),
    formatPercent(summary.weightedAverageViewed),
    tableCell(summary.latestPublishedAt ?? "unknown"),
    tableCell(summary.topTitle),
  ]);
}

function latestPublishedAt(records: AnalyticsRecord[]): string | undefined {
  return records
    .map((record) => record.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0];
}

function weightedAverage(
  records: AnalyticsRecord[],
  valueKey: keyof AnalyticsRecord,
  weightKey: keyof AnalyticsRecord,
): number | undefined {
  let numerator = 0;
  let denominator = 0;
  for (const record of records) {
    const value = record[valueKey];
    const weight = record[weightKey];
    if (typeof value === "number" && typeof weight === "number" && weight > 0) {
      numerator += value * weight;
      denominator += weight;
    }
  }
  return denominator > 0 ? numerator / denominator : undefined;
}

function sum(records: AnalyticsRecord[], key: keyof AnalyticsRecord): number {
  return records.reduce((total, record) => {
    const value = record[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function formatInteger(value: number | undefined): string {
  return typeof value === "number" ? Math.round(value).toLocaleString("en-US") : "unknown";
}

function formatPercent(value: number | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "unknown";
}

function formatSeconds(value: number | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}s` : "unknown";
}

function tableCell(value: string): string {
  return inlineText(value).replaceAll("|", "/");
}

function inlineText(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ").trim();
}
