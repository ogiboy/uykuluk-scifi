import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, writeTextFile } from "../utils/fs.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import { parseCsvRows } from "./csv.js";
import { normalizeAnalyticsRecord } from "./normalization.js";
import { renderAnalyticsReport } from "./report.js";
import { analyticsDatasetSchema, type AnalyticsDataset } from "./schema.js";

const ANALYTICS_DIR = "analytics";
export const analyticsDatasetPath = `${ANALYTICS_DIR}/performance.json`;
export const analyticsReportPath = `${ANALYTICS_DIR}/performance_report.md`;

export type AnalyticsImportResult = {
  format: "csv" | "json";
  outputPath: string;
  recordCount: number;
  reportPath: string;
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
  await ensureDir(ANALYTICS_DIR);
  await writeJsonFile(analyticsDatasetPath, dataset);
  await writeTextFile(analyticsReportPath, renderAnalyticsReport(dataset));
  return {
    format,
    outputPath: analyticsDatasetPath,
    recordCount: dataset.records.length,
    reportPath: analyticsReportPath,
  };
}

export async function loadAnalyticsDataset(): Promise<AnalyticsDataset> {
  return analyticsDatasetSchema.parse(await readJsonFile<unknown>(analyticsDatasetPath));
}

export async function renderSavedAnalyticsReport(): Promise<string> {
  return renderAnalyticsReport(await loadAnalyticsDataset());
}

function inferFormat(inputPath: string): "csv" | "json" {
  return path.extname(inputPath).toLowerCase() === ".json" ? "json" : "csv";
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
