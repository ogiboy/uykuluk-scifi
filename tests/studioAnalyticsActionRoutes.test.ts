import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as importAnalytics } from "../apps/studio/src/app/actions/analytics-import/route";
import { POST as refreshAnalyticsReport } from "../apps/studio/src/app/actions/analytics-report/route";
import { useTempProject } from "./helpers";
import {
  studioJsonMutationRequest,
  type StudioMutationRequestOptions,
} from "./studioMutationRouteTestHelpers";

describe("Studio analytics action routes", () => {
  useTempProject();

  it("imports manual analytics through the guarded Studio route", async () => {
    const response = await importAnalytics(
      studioJsonRequest("/actions/analytics-import", "analytics.import", {
        content: [
          "run_id,video_id,title,published_at,impressions,views,ctr,avg_percentage_viewed",
          "run_20260624010101_abcd12,yt_web,Studio Import,2026-06-20T12:00:00.000Z,100,25,5%,30%",
        ].join("\n"),
        format: "csv",
        sourceFileName: "studio-performance.csv",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionId: "analytics.import",
      record: {
        format: "csv",
        outputPath: "analytics/performance.json",
        recordCount: 1,
        reportPath: "analytics/performance_report.md",
      },
      status: "ok",
    });
    await expect(readFile("analytics/performance.json", "utf8")).resolves.toContain("yt_web");
    await expect(readFile("analytics/performance_report.md", "utf8")).resolves.toContain(
      "Manual Analytics Report",
    );
  });

  it("refreshes analytics reports through the guarded Studio route", async () => {
    await importAnalytics(
      studioJsonRequest("/actions/analytics-import", "analytics.import", {
        content: "video_id,title,views\nyt_refresh,Refresh Me,10\n",
        format: "csv",
        sourceFileName: "refresh.csv",
      }),
    );

    const response = await refreshAnalyticsReport(
      studioJsonRequest("/actions/analytics-report", "analytics.report", {}),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionId: "analytics.report",
      record: {
        report: expect.stringContaining("Manual Analytics Report"),
        reportPath: "analytics/performance_report.md",
      },
      status: "ok",
    });
  });

  it("rejects unsafe analytics import requests before CLI execution", async () => {
    await expectRouteError(
      importAnalytics(studioJsonRequest("/actions/analytics-import", "", {})),
      403,
    );
    await expectRouteError(
      importAnalytics(
        studioJsonRequest(
          "/actions/analytics-import",
          "analytics.import",
          {
            content: "video_id,title,views\nyt_bad,Bad,1\n",
            format: "csv",
            sourceFileName: "../bad.csv",
          },
          { origin: "https://attacker.example" },
        ),
      ),
      403,
    );
    await expectRouteError(
      importAnalytics(
        studioJsonRequest("/actions/analytics-import", "analytics.import", {
          content: "video_id,title,views\nyt_bad,Bad,1\n",
          format: "csv",
          sourceFileName: "../bad.csv",
        }),
      ),
      400,
    );
    await expectRouteError(
      refreshAnalyticsReport(
        studioJsonRequest("/actions/analytics-report", "analytics.report", {
          runId: "run_unexpected",
        }),
      ),
      400,
    );
  });
});

function studioJsonRequest(
  routePath: string,
  actionHeader: string,
  body: unknown,
  options: StudioMutationRequestOptions = {},
): Request {
  return studioJsonMutationRequest(routePath, actionHeader, body, options);
}

async function expectRouteError(responsePromise: Promise<Response>, status: number): Promise<void> {
  const response = await responsePromise;
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "error" });
}
