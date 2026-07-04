import "./product-uat-studio-readonly";
import { POST as importAnalytics } from "../../apps/studio/src/app/actions/analytics-import/route";
import { POST as refreshAnalyticsReport } from "../../apps/studio/src/app/actions/analytics-report/route";
import { getStudioAnalyticsOverview } from "../../apps/studio/src/lib/analyticsOverview";
import { studioJsonRequest, studioSessionCookie } from "./product-uat-studio-http";

const runId = process.argv[2];

if (!runId) {
  fail("Missing run id.");
}

const session = await studioSessionCookie(assert);

await expectRouteError(
  importAnalytics(
    studioJsonRequest(session, "/actions/analytics-import", "analytics.import", {
      content: "video_id,title,views\nyt_bad,Bad,1\n",
      format: "csv",
      sourceFileName: "../bad.csv",
    }),
  ),
  400,
);
await expectRouteError(
  refreshAnalyticsReport(
    studioJsonRequest(session, "/actions/analytics-report", "analytics.report", {
      runId,
    }),
  ),
  400,
);

const importResponse = await importAnalytics(
  studioJsonRequest(session, "/actions/analytics-import", "analytics.import", {
    content: [
      "run_id,video_id,title,published_at,impressions,views,ctr,avg_view_duration_seconds,avg_percentage_viewed,subscribers_gained,likes,comments,notes",
      `${runId},yt_studio_rendered,"Studio Rendered Draft Review",2026-06-29T12:00:00.000Z,10000,1250,7.4%,181,42%,12,90,8,"Imported through Studio action"`,
      ',yt_studio_unmapped,"Studio Unmapped Topic",2026-06-29T13:00:00.000Z,3000,90,1.8%,35,12%,0,4,1,"Needs run link"',
    ].join("\n"),
    format: "csv",
    sourceFileName: "studio-performance.csv",
  }),
);
const importPayload = (await importResponse.json().catch(() => null)) as {
  actionId?: string;
  message?: string;
  record?: { outputPath?: string; recordCount?: number; reportPath?: string };
  status?: string;
} | null;

assert(
  importResponse.status === 200,
  `Studio analytics import returned HTTP ${importResponse.status}.`,
);
assert(importPayload?.status === "ok", importPayload?.message ?? "Studio analytics import failed.");
assert(importPayload.actionId === "analytics.import", "Studio analytics import action id matches.");
assert(importPayload.record?.recordCount === 2, "Studio analytics import writes two records.");
assert(
  importPayload.record?.outputPath === "analytics/performance.json",
  "Studio analytics import writes the dataset artifact.",
);
assert(
  importPayload.record?.reportPath === "analytics/performance_report.md",
  "Studio analytics import writes the report artifact.",
);

const reportResponse = await refreshAnalyticsReport(
  studioJsonRequest(session, "/actions/analytics-report", "analytics.report", {}),
);
const reportPayload = (await reportResponse.json().catch(() => null)) as {
  actionId?: string;
  message?: string;
  record?: { report?: string; reportPath?: string };
  status?: string;
} | null;

assert(
  reportResponse.status === 200,
  `Studio analytics report returned HTTP ${reportResponse.status}.`,
);
assert(reportPayload?.status === "ok", reportPayload?.message ?? "Studio analytics report failed.");
assert(reportPayload.actionId === "analytics.report", "Studio analytics report action id matches.");
assert(
  reportPayload.record?.report?.includes("Manual Analytics Report") === true,
  "Studio analytics report refresh returns report markdown.",
);

const analytics = await getStudioAnalyticsOverview();
assert(analytics.status === "ready", "Studio analytics overview stays ready after web import.");
assert(analytics.recordCount === 2, "Studio analytics overview sees web-imported records.");
assert(
  analytics.mappedRunCount === 1,
  "Studio analytics overview sees the mapped web-imported run.",
);
assert(
  analytics.reportStatus === "current",
  "Studio analytics report stays current after refresh.",
);

console.log("Studio services UAT passed.");

async function expectRouteError(responsePromise: Promise<Response>, status: number): Promise<void> {
  const response = await responsePromise;
  assert(response.status === status, `Expected HTTP ${status}, received ${response.status}.`);
  const payload = (await response.json().catch(() => null)) as { status?: string } | null;
  assert(payload?.status === "error", "Rejected Studio analytics route returns an error payload.");
}

/**
 * Records a failed Studio services product UAT assertion.
 *
 * @param message - Failure message.
 * @returns Never returns.
 */
function fail(message: string): never {
  throw new Error(`Studio services product UAT failed: ${message}`);
}

/**
 * Asserts a Studio services product UAT condition.
 *
 * @param condition - Condition to validate.
 * @param message - Failure message.
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}
