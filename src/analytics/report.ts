import { table } from "../utils/markdown.js";
import type { AnalyticsDataset, AnalyticsRecord } from "./schema.js";

export function renderAnalyticsReport(dataset: AnalyticsDataset): string {
  const totals = summarize(dataset.records);
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
      ],
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
    "## Operator Notes",
    "",
    ...operatorNotes(dataset.records),
  ].join("\n");
}

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

function operatorNotes(records: AnalyticsRecord[]): string[] {
  const highCtr = records.filter((record) => (record.ctr ?? 0) >= 0.06);
  const weakRetention = records.filter((record) => (record.averagePercentageViewed ?? 1) < 0.25);
  return [
    `- Repeat candidates: ${formatRecordList(highCtr)}.`,
    `- Review retention risks: ${formatRecordList(weakRetention)}.`,
    "- Test next: compare topic, title, thumbnail promise, and first-minute hook before changing the production format.",
    "- Evidence limit: treat these as review prompts, not proof that one variable caused the result.",
  ];
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

function formatRecordList(records: AnalyticsRecord[]): string {
  if (records.length === 0) {
    return "none yet";
  }
  return records.map((record) => inlineText(record.title ?? record.videoId)).join(", ");
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
