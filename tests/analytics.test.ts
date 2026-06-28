import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  importAnalyticsFile,
  loadAnalyticsDataset,
  refreshSavedAnalyticsReport,
} from "../src/analytics/import";
import { renderAnalyticsRecommendations } from "../src/analytics/recommendations";
import { useTempProject } from "./helpers";

describe("manual analytics import", () => {
  useTempProject();

  it("imports operator CSV performance data into local analytics artifacts", async () => {
    await writeFile(
      "performance.csv",
      [
        "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes",
        'run_20260624010101_abcd12,yt_001,"Ay Üssünde İlk Temas",2026-06-20T12:00:00.000Z,10000,1200,7.5%,181,42%,12,90,8,"Strong hook"',
        'run_20260624010101_abcd12,yt_002,"Kayıp Sonda",2026-06-21T12:00:00.000Z,5000,250,2.1%,73,19%,1,12,2,"Weak retention"',
        ',yt_003,"Haritasız Uydu",2026-06-22T12:00:00.000Z,4000,100,1.8%,40,12%,0,6,1,"No run link yet"',
      ].join("\n"),
      "utf8",
    );

    const result = await importAnalyticsFile("performance.csv");
    const dataset = await loadAnalyticsDataset();
    const report = await readFile("analytics/performance_report.md", "utf8");

    expect(result).toMatchObject({
      format: "csv",
      recordCount: 3,
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
    expect(report).toContain("3 performance record(s)");
    expect(report).toContain("Weighted CTR");
    expect(report).toContain("Run Link Summary");
    expect(report).toContain("Mapped runs");
    expect(report).toContain("Unmapped records");
    expect(report).toContain("| run_20260624010101_abcd12 | 2 | 1,450 |");
    expect(report).toContain("Import Data Quality");
    expect(report).toContain("| High confidence records | 2 |");
    expect(report).toContain("| Medium confidence records | 1 |");
    expect(report).toContain("| Missing run links | 1 |");
    expect(report).toContain("| Missing CTR | 0 |");
    expect(report).toContain("| Missing retention | 0 |");
    expect(report).toContain(
      "Next data-quality action: Add run_id values before comparing imported videos back to producer runs.",
    );
    expect(report).toContain("Non-Causal Recommendations");
    expect(report).toContain("Repeat candidates");
    expect(report).toContain(
      "- Ay Üssünde İlk Temas (run_20260624010101_abcd12): strong CTR, strong retention, subscriber gain (confidence: high; run-linked with views, impressions, CTR, and retention).",
    );
    expect(report).toContain("Avoid without revision");
    expect(report).not.toContain(
      "- Kayıp Sonda (run_20260624010101_abcd12): weak CTR, weak retention (confidence: high; run-linked with views, impressions, CTR, and retention).",
    );
    expect(report).toContain(
      "- Haritasız Uydu (unmapped): weak CTR, weak retention (confidence: medium; missing run link).",
    );
    expect(report).toContain("Mixed signals to inspect");
    expect(report).toContain(
      "- Kayıp Sonda (run_20260624010101_abcd12): repeat signals: subscriber gain, avoid signals: weak CTR, weak retention (confidence: high; run-linked with views, impressions, CTR, and retention).",
    );
    expect(report).toContain("Test next");
    expect(report).toContain("one topic/title/thumbnail hypothesis");
    expect(report).toContain("Missing impressions, retention, or run links reduce confidence");
    expect(report).toContain("No causal claims are made from this import.");
    expect(report).toContain("not proof that one variable caused the result");
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

  it("refreshes the local report artifact from the saved dataset", async () => {
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
            averagePercentageViewed: 0.38,
          },
        ],
      }),
      "utf8",
    );

    await importAnalyticsFile("performance.json");
    await writeFile("analytics/performance_report.md", "# stale report\n", "utf8");

    const result = await refreshSavedAnalyticsReport();
    const report = await readFile("analytics/performance_report.md", "utf8");
    const dataset = await loadAnalyticsDataset();

    expect(result.reportPath).toBe("analytics/performance_report.md");
    expect(result.report).toBe(report);
    expect(report).toContain(dataset.generatedAt);
    expect(report).toContain(dataset.source.sha256);
    expect(report).toContain("Non-Causal Recommendations");
  });

  it("classifies mixed-signal records separately from repeat and avoid", () => {
    const recommendations = renderAnalyticsRecommendations([
      {
        averagePercentageViewed: 0.18,
        ctr: 0.071,
        runId: "run_20260624010303_abcd14",
        title: "Kararsız Sinyal",
        videoId: "yt_mixed",
      },
    ]).join("\n");

    expect(recommendations).toContain("Mixed signals to inspect");
    expect(recommendations).toContain(
      "- Kararsız Sinyal (run_20260624010303_abcd14): repeat signals: strong CTR, avoid signals: weak retention (confidence: medium; missing views, impressions).",
    );
    expect(recommendations).toContain("No repeat candidate yet.");
    expect(recommendations).toContain("No avoid candidate yet.");
  });
});
