import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { importAnalyticsFile, loadAnalyticsDataset } from "../src/analytics/import";
import { useTempProject } from "./helpers";

describe("manual analytics import", () => {
  useTempProject();

  it("imports operator CSV performance data into local analytics artifacts", async () => {
    await writeFile(
      "performance.csv",
      [
        "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes",
        'run_20260624010101_abcd12,yt_001,"Ay Üssünde İlk Temas",2026-06-20T12:00:00.000Z,10000,1200,7.5%,181,42%,12,90,8,"Strong hook"',
        'run_20260624010202_abcd13,yt_002,"Kayıp Sonda",2026-06-21T12:00:00.000Z,5000,250,2.1%,73,19%,1,12,2,"Weak retention"',
      ].join("\n"),
      "utf8",
    );

    const result = await importAnalyticsFile("performance.csv");
    const dataset = await loadAnalyticsDataset();
    const report = await readFile("analytics/performance_report.md", "utf8");

    expect(result).toMatchObject({
      format: "csv",
      recordCount: 2,
      outputPath: "analytics/performance.json",
      reportPath: "analytics/performance_report.md",
    });
    expect(dataset.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: "run_20260624010101_abcd12",
          videoId: "yt_001",
          views: 1200,
          ctr: 0.075,
          averagePercentageViewed: 0.42,
        }),
        expect.objectContaining({
          videoId: "yt_002",
          ctr: 0.021,
          averagePercentageViewed: 0.19,
        }),
      ]),
    );
    expect(report).toContain("Manual Analytics Report");
    expect(report).toContain("2 performance record(s)");
    expect(report).toContain("Weighted CTR");
    expect(report).toContain("No causal claims are made from this import.");
  });

  it("imports JSON records and rejects malformed rows without writing artifacts", async () => {
    await writeFile(
      "performance.json",
      JSON.stringify({
        records: [
          {
            runId: "run_20260624010303_abcd14",
            videoId: "yt_003",
            title: "Sessiz Gezegen",
            views: 800,
            impressions: 9000,
            ctr: 0.061,
          },
        ],
      }),
      "utf8",
    );
    await writeFile("bad.json", JSON.stringify([{ title: "missing video id" }]), "utf8");

    await expect(importAnalyticsFile("bad.json")).rejects.toThrow(/videoId/i);

    const result = await importAnalyticsFile("performance.json");
    const dataset = await loadAnalyticsDataset();

    expect(result.format).toBe("json");
    expect(dataset.records).toHaveLength(1);
    expect(dataset.records[0]).toMatchObject({
      runId: "run_20260624010303_abcd14",
      videoId: "yt_003",
      ctr: 0.061,
    });
  });
});
