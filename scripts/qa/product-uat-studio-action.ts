import { POST } from "../../apps/studio/src/app/actions/decide-render/route";
import { getStudioRunDetail } from "../../apps/studio/src/lib/runSummaries";
import { studioActionHeaderName } from "../../apps/studio/src/lib/studioMutationSecurity";

const runId = process.argv[2];

if (!runId) {
  fail("Missing run id.");
}

const response = await POST(
  new Request("http://localhost:3000/actions/decide-render", {
    body: JSON.stringify({
      decision: "accepted-for-local-review",
      notes: "Product UAT accepted this local draft for manual channel review.",
      reviewedBy: "product-uat",
      runId,
    }),
    headers: {
      [studioActionHeaderName]: "render.decide",
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    method: "POST",
  }),
);

const payload = (await response.json().catch(() => null)) as {
  actionId?: string;
  message?: string;
  record?: { decision?: string; reviewedBy?: string; runId?: string };
  status?: string;
} | null;

assert(response.status === 200, `Studio action returned HTTP ${response.status}.`);
assert(payload?.status === "ok", payload?.message ?? "Studio action did not return ok.");
assert(payload.actionId === "render.decide", "Studio action id is render.decide.");
assert(payload.record?.runId === runId, "Studio action persisted the expected run id.");
assert(
  payload.record?.decision === "accepted-for-local-review",
  "Studio action persisted the expected decision.",
);
assert(payload.record?.reviewedBy === "product-uat", "Studio action persisted reviewer name.");

const detail = await getStudioRunDetail(runId);
assert(detail !== null, "Studio can reload the decided run.");
assert(detail.renderDecision.kind === "present", "Studio sees the persisted render decision.");
assert(
  detail.renderDecision.kind === "present" &&
    detail.renderDecision.decision.reviewedBy === "product-uat",
  "Studio detail trusts the product UAT render decision.",
);
assert(
  detail.renderDecisionCommands.length === 0,
  "Studio hides render decision commands after a decision is recorded.",
);

console.log("Studio render-decision action UAT passed.");

/**
 * Records a failed Studio action product UAT assertion.
 *
 * @param message - Failure message.
 * @returns Never returns.
 */
function fail(message: string): never {
  throw new Error(`Studio render-decision action UAT failed: ${message}`);
}

/**
 * Asserts a Studio action product UAT condition.
 *
 * @param condition - Condition to validate.
 * @param message - Failure message.
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}
