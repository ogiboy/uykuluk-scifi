import type { AnalyticsRecord } from "./schema.js";

/**
 * Builds rows for imported records that are not linked back to a Producer run.
 *
 * @param records - Imported analytics records to inspect
 * @returns Markdown table rows showing the records that need a `run_id`, or a single all-clear row
 */
export function unmappedRecordRows(records: AnalyticsRecord[]): string[][] {
  const unmapped = records.filter((record) => !record.runId);
  if (unmapped.length === 0) {
    return [["none", "All imported records include run_id.", "0", "unknown", "No action needed"]];
  }
  const sortedUnmapped = [...unmapped];
  sortedUnmapped.sort(compareByViewsDescending);
  return sortedUnmapped
    .slice(0, 10)
    .map((record) => [
      tableCell(record.videoId),
      tableCell(record.title ?? "unknown"),
      formatInteger(record.views),
      tableCell(record.publishedAt ?? "unknown"),
      "Add run_id in the next import.",
    ]);
}

function compareByViewsDescending(left: AnalyticsRecord, right: AnalyticsRecord): number {
  return viewsForSorting(right) - viewsForSorting(left);
}

function viewsForSorting(record: AnalyticsRecord): number {
  return typeof record.views === "number" ? record.views : 0;
}

/**
 * Formats a whole number for display.
 *
 * @param value - The number to format
 * @returns The rounded value formatted with US locale separators, or `"unknown"` when no value is available
 */
function formatInteger(value: number | undefined): string {
  return typeof value === "number" ? Math.round(value).toLocaleString("en-US") : "unknown";
}

/**
 * Formats a Markdown table cell.
 *
 * @param value - Raw text to normalize for a table cell
 * @returns A single-line cell value with table separators replaced
 */
function tableCell(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ").trim().replaceAll("|", "/");
}
