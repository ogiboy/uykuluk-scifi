import { getStudioActionServiceStatus } from "../../apps/studio/src/lib/actionServiceStatus";
import { getStudioAnalyticsOverview } from "../../apps/studio/src/lib/analyticsOverview";
import { getStudioRunDetail, listStudioRuns } from "../../apps/studio/src/lib/runSummaries";

const runId = process.argv[2];

if (!runId) {
  fail("Missing run id.");
}

const reviewCommand = `pnpm producer review render --run ${runId}`;
const voiceReviewCommand = `pnpm producer review voice --run ${runId}`;
const renderApprovalCommand = `pnpm producer approve render --run ${runId}`;
const decisionReviewCommand = `pnpm producer review render-decision --run ${runId}`;
const summaries = await listStudioRuns();
const summary = summaries.find((candidate) => candidate.runId === runId);

assert(summary !== undefined, "Studio run index includes rendered run.");
assert(summary.state === "RENDERED", "Studio run index shows rendered state.");
assert(
  summary.nextRecommendedCommand?.includes("Manually review production/channel_handoff.md") ===
    true,
  "Studio run index exposes manual channel handoff review as the next safe action.",
);
assert(
  summary.renderDecision.kind === "present",
  "Studio run index exposes render decision status.",
);
assert(summary.evidenceStatus === "available", "Studio run index trusts only current evidence.");
assert(summary.readinessPassed === true, "Studio run index shows passing readiness.");
assert(summary.readinessStatus === "passed", "Studio run index shows current readiness status.");

const detail = await getStudioRunDetail(runId);
assert(detail !== null, "Studio run detail loads rendered run.");
assert(detail.state === "RENDERED", "Studio run detail shows rendered state.");
assert(
  detail.nextRecommendedCommand?.includes("Manually review production/channel_handoff.md") === true,
  "Studio run detail exposes manual channel handoff review as the next safe action.",
);
assert(
  detail.renderDecision.kind === "present",
  "Studio run detail exposes render decision status.",
);
assert(
  detail.renderDecision.kind === "present" &&
    detail.renderDecision.reviewCommand === decisionReviewCommand,
  "Studio run detail exposes the render-decision review command.",
);
assert(detail.evidence?.currentState === "RENDERED", "Studio run detail loads current evidence.");
assert(detail.readiness?.passed === true, "Studio run detail loads passing readiness.");
assert(
  detail.productionMedia.some(
    (item) =>
      item.label === "Draft render" &&
      item.status === "pass" &&
      item.reviewCommand === reviewCommand,
  ),
  "Studio production media exposes the draft render review command.",
);
assert(
  detail.productionMedia.some(
    (item) =>
      item.label === "Voiceover audio" &&
      item.status === "pass" &&
      item.reviewCommand === voiceReviewCommand &&
      item.renderApprovalCommand === renderApprovalCommand &&
      item.renderApprovalScope === "timing-draft-only",
  ),
  "Studio production media exposes voiceover review scope and render approval command.",
);
assert(
  detail.artifacts.some((item) => item.path === "production/render/draft_review.md" && item.exists),
  "Studio artifact previews include draft review markdown.",
);
assert(
  detail.artifacts.some(
    (item) => item.path === "production/render/render_manifest.json" && item.exists,
  ),
  "Studio artifact previews include render manifest.",
);
assert(
  detail.artifacts.some(
    (item) => item.path === "production/render/render_decision.md" && item.exists,
  ),
  "Studio artifact previews include render decision markdown.",
);
assert(
  detail.artifacts.some((item) => item.path === "production/channel_handoff.md" && item.exists),
  "Studio artifact previews include manual channel handoff markdown.",
);
assert(
  detail.channelHandoff.kind === "present",
  "Studio run detail surfaces completed manual channel handoff.",
);
assert(
  detail.nextRecommendedCommand?.includes("Manually review production/channel_handoff.md") === true,
  "Studio next action moves to manual channel handoff review after package generation.",
);
assert(
  detail.workflowProgress.some(
    (step) =>
      step.label === "Manual channel handoff" &&
      step.status === "done" &&
      step.detail.includes("ready for local operator review"),
  ),
  "Studio workflow progress marks manual channel handoff done.",
);

const analytics = await getStudioAnalyticsOverview();
assert(analytics.status === "ready", "Studio analytics overview is ready.");
assert(analytics.recordCount === 2, "Studio analytics sees imported records.");
assert(analytics.mappedRunCount === 1, "Studio analytics sees the mapped run.");
assert(analytics.unmappedRecordCount === 1, "Studio analytics sees the unmapped record.");
assert(
  analytics.nextCommand === "pnpm producer analytics report",
  "Studio analytics keeps the report refresh command visible.",
);
assert(analytics.reportStatus === "current", "Studio analytics report preview is current.");
assert(
  analytics.reportPreview?.includes("No causal claims are made from this import.") === true,
  "Studio analytics preview preserves non-causal guidance.",
);

const actions = getStudioActionServiceStatus();
assert(actions.actionCount > 0, "Studio action contracts are discoverable.");
assert(
  actions.webMutationsEnabled === true,
  "Studio exposes only the guarded local render-decision mutation.",
);
assert(actions.findings.length === 0, "Studio action service has no route-security findings.");
assert(
  actions.summaries.some(
    (item) => item.actionId === "render.decide" && item.routePath === "/actions/decide-render",
  ),
  "Studio action service exposes the guarded render-decision route.",
);
assert(
  actions.summaries.some(
    (item) => item.actionId === "publish.schedule" && item.availability === "disabled-external",
  ),
  "Studio action service keeps publish disabled.",
);

console.log("Studio read-only UAT passed.");

/**
 * Records a failed Studio product UAT assertion.
 *
 * @param message - Failure message.
 * @returns Never returns.
 */
function fail(message: string): never {
  throw new Error(`Studio read-only product UAT failed: ${message}`);
}

/**
 * Asserts a Studio product UAT condition.
 *
 * @param condition - Condition to validate.
 * @param message - Failure message.
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}
