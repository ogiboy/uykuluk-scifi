import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeTextFile } from "../utils/fs.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import { parseCsvRows } from "./csv.js";
import { normalizeAnalyticsRecord } from "./normalization.js";
import {
  ANALYTICS_DIR,
  analyticsDatasetPath,
  analyticsReportPath,
  analyticsRunLinkTemplatePath,
} from "./paths.js";
import { renderAnalyticsReport } from "./report.js";
import { renderRunLinkTemplate } from "./runLinkTemplate.js";
import { analyticsDatasetSchema, type AnalyticsDataset } from "./schema.js";

export type AnalyticsImportResult = {
  format: "csv" | "json";
  outputPath: string;
  recordCount: number;
  reportPath: string;
  runLinkTemplatePath: string;
};

export async function importAnalyticsFile(inputPath: string): Promise<AnalyticsImportResult> {
  const source = await readFile(inputPath);
  const format = inferFormat(inputPath);
  const records =
    format === "json"
      ? parseJsonRecords(source.toString("utf8"))
      : parseCsvRows(source.toString("utf8")).map(normalizeAnalyticsRecord);
  const dataset = analyticsDatasetSchema.parse({
    generatedAt: nowIso(),
    records,
    schemaVersion: 1,
    source: {
      fileName: path.basename(inputPath),
      format,
      recordCount: records.length,
      sha256: createHash("sha256").update(source).digest("hex"),
    },
  });
  await writeAnalyticsArtifacts(dataset);
  return {
    format,
    outputPath: analyticsDatasetPath,
    recordCount: dataset.records.length,
    reportPath: analyticsReportPath,
    runLinkTemplatePath: analyticsRunLinkTemplatePath,
  };
}

export async function loadAnalyticsDataset(): Promise<AnalyticsDataset> {
  return analyticsDatasetSchema.parse(await readJsonFile<unknown>(analyticsDatasetPath));
}

/**
 * Renders the saved analytics dataset as a Markdown report.
 *
 * @returns The rendered Markdown report.
 */
export async function renderSavedAnalyticsReport(): Promise<string> {
  return renderAnalyticsReport(await loadAnalyticsDataset());
}

/**
 * Regenerates the saved analytics report and writes it to disk.
 *
 * @returns An object containing the rendered `report` and its `reportPath`.
 */
export async function refreshSavedAnalyticsReport(): Promise<{
  report: string;
  reportPath: string;
  runLinkTemplatePath: string;
}> {
  const dataset = await loadAnalyticsDataset();
  const report = renderAnalyticsReport(dataset);
  await writeAnalyticsArtifacts(dataset);
  return {
    report,
    reportPath: analyticsReportPath,
    runLinkTemplatePath: analyticsRunLinkTemplatePath,
  };
}

/**
 * Determines the analytics file format from its extension.
 *
 * @param inputPath - The input file path
 * @returns `"json"` for `.json` files, `"csv"` otherwise
 */
function inferFormat(inputPath: string): "csv" | "json" {
  return path.extname(inputPath).toLowerCase() === ".json" ? "json" : "csv";
}

async function writeAnalyticsArtifacts(dataset: AnalyticsDataset): Promise<void> {
  await ensureDir(ANALYTICS_DIR);
  await writeJsonFile(analyticsDatasetPath, dataset);
  await writeTextFile(analyticsReportPath, renderAnalyticsReport(dataset));
  await writeTextFile(analyticsRunLinkTemplatePath, renderRunLinkTemplate(dataset.records));
}

function parseJsonRecords(input: string): ReturnType<typeof normalizeAnalyticsRecord>[] {
  const parsed = JSON.parse(input) as unknown;
  const rows =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) && "records" in parsed
      ? (parsed as { records?: unknown }).records
      : parsed;
  if (!Array.isArray(rows)) {
    return [normalizeAnalyticsRecord(rows)];
  }
  return rows.map(normalizeAnalyticsRecord);
}
