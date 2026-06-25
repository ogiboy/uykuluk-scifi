import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioAnalyticsOverview } from "../apps/studio/src/lib/analyticsOverview";
import { useTempProject } from "./helpers";

const importedDataset = {
  generatedAt: "2026-06-25T00:00:00.000Z",
  records: [
    {
      averagePercentageViewed: 0.42,
      ctr: 0.075,
      impressions: 10_000,
      runId: "run_20260625010101_abcd12",
      title: "Ay Üssünde İlk Temas",
      videoId: "yt_001",
      views: 1_200,
    },
    {
      ctr: 0.021,
      impressions: 5_000,
      runId: "run_20260625010101_abcd12",
      title: "Kayıp Sonda",
      videoId: "yt_002",
      views: 250,
    },
    {
      impressions: 4_000,
      title: "Haritasız Uydu",
      videoId: "yt_003",
      views: 100,
    },
  ],
  schemaVersion: 1,
  source: {
    fileName: "performance.csv",
    format: "csv",
    recordCount: 3,
    sha256: "a".repeat(64),
  },
};

describe("Studio analytics overview", () => {
  useTempProject();

  it("returns a safe missing state before analytics are imported", async () => {
    const overview = await getStudioAnalyticsOverview();

    expect(overview).toMatchObject({
      dataQuality: {
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
      },
      error: null,
      nextCommand: "pnpm producer analytics import --file performance.csv",
      recordCount: 0,
      reportPreview: null,
      status: "missing",
    });
  });

  it("summarizes local operator-provided analytics artifacts without mutation", async () => {
    await mkdir("analytics", { recursive: true });
    await writeFile("analytics/performance.json", JSON.stringify(importedDataset), "utf8");
    await writeFile(
      "analytics/performance_report.md",
      [
        "# Manual Analytics Report",
        "",
        "Generated: 2026-06-25T00:00:00.000Z",
        `Source: performance.csv (csv, ${"a".repeat(64)})`,
        "",
        "No causal claims are made from this import.",
      ].join("\n"),
      "utf8",
    );

    const overview = await getStudioAnalyticsOverview();

    expect(overview).toMatchObject({
      dataQuality: {
        highConfidenceRecordCount: 1,
        lowConfidenceRecordCount: 1,
        mediumConfidenceRecordCount: 1,
        missingCtrCount: 1,
        missingImpressionsCount: 0,
        missingRetentionCount: 2,
        missingRunLinkCount: 1,
        missingViewsCount: 0,
        nextDataQualityAction:
          "Add run_id values before comparing imported videos back to producer runs.",
      },
      datasetPath: "analytics/performance.json",
      error: null,
      generatedAt: "2026-06-25T00:00:00.000Z",
      mappedRunCount: 1,
      nextCommand: "pnpm producer analytics report",
      recordCount: 3,
      reportPath: "analytics/performance_report.md",
      reportPreview: expect.stringContaining("Manual Analytics Report"),
      reportPreviewTruncated: false,
      reportStatus: "current",
      reportWarning: null,
      sourceFileName: "performance.csv",
      sourceFormat: "csv",
      status: "ready",
      totalImpressions: 19_000,
      totalViews: 1_550,
      unmappedRecordCount: 1,
    });
    expect(overview.topVideos).toEqual([
      {
        runId: "run_20260625010101_abcd12",
        title: "Ay Üssünde İlk Temas",
        videoId: "yt_001",
        views: 1_200,
      },
      {
        runId: "run_20260625010101_abcd12",
        title: "Kayıp Sonda",
        videoId: "yt_002",
        views: 250,
      },
      {
        runId: null,
        title: "Haritasız Uydu",
        videoId: "yt_003",
        views: 100,
      },
    ]);
  });

  it("warns when the local analytics report does not match the current dataset", async () => {
    await mkdir("analytics", { recursive: true });
    await writeFile("analytics/performance.json", JSON.stringify(importedDataset), "utf8");
    await writeFile(
      "analytics/performance_report.md",
      "# Manual Analytics Report\n\nGenerated: 2026-06-20T00:00:00.000Z\nSource: old.csv (csv, b)\n",
      "utf8",
    );

    const overview = await getStudioAnalyticsOverview();

    expect(overview).toMatchObject({
      nextCommand: "pnpm producer analytics report",
      reportStatus: "stale",
      reportWarning:
        "Report artifact does not match the current dataset. Refresh it before review.",
    });
  });

  it("fails closed on invalid local analytics data", async () => {
    await mkdir("analytics", { recursive: true });
    await writeFile("analytics/performance.json", JSON.stringify({ records: [] }), "utf8");

    const overview = await getStudioAnalyticsOverview();

    expect(overview).toMatchObject({
      dataQuality: {
        highConfidenceRecordCount: 0,
        lowConfidenceRecordCount: 0,
        mediumConfidenceRecordCount: 0,
      },
      error: "analytics/performance.json is missing required fields.",
      nextCommand: "pnpm producer analytics import --file performance.csv",
      recordCount: 0,
      reportStatus: "missing",
      status: "invalid",
    });
  });
});
