import type { AnalyticsRecord } from "./schema.js";

const TEMPLATE_HEADER = ["run_id", "video_id", "title", "published_at", "views", "notes"];

/**
 * Builds a fillable CSV template for imported videos that still need a Producer run link.
 *
 * @param records - Imported analytics records to inspect
 * @returns CSV text with one row per unmapped record
 */
export function renderRunLinkTemplate(records: AnalyticsRecord[]): string {
  const unmapped = records.filter((record) => !record.runId);
  const sortedUnmapped = [...unmapped];
  sortedUnmapped.sort(compareByViewsDescending);
  return [
    csvRow(TEMPLATE_HEADER),
    ...sortedUnmapped.map((record) =>
      csvRow([
        "",
        record.videoId,
        record.title ?? "",
        record.publishedAt ?? "",
        formatInteger(record.views),
        "Fill run_id, then include it in the next analytics import.",
      ]),
    ),
  ].join("\n");
}

function compareByViewsDescending(left: AnalyticsRecord, right: AnalyticsRecord): number {
  return viewsForSorting(right) - viewsForSorting(left);
}

function viewsForSorting(record: AnalyticsRecord): number {
  return typeof record.views === "number" ? record.views : 0;
}

function formatInteger(value: number | undefined): string {
  return typeof value === "number" ? String(Math.round(value)) : "";
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
