import { POST as approveIdea } from "../../apps/studio/src/app/actions/approve-idea/route";
import { POST as approveRender } from "../../apps/studio/src/app/actions/approve-render/route";
import { POST as approveScript } from "../../apps/studio/src/app/actions/approve-script/route";
import { POST as decideChannelHandoff } from "../../apps/studio/src/app/actions/decide-channel-handoff/route";
import { POST as decideRender } from "../../apps/studio/src/app/actions/decide-render/route";
import { POST as reviewRenderPlan } from "../../apps/studio/src/app/actions/review-render-plan/route";
import { POST as reviewRender } from "../../apps/studio/src/app/actions/review-render/route";
import { POST as reviewScript } from "../../apps/studio/src/app/actions/review-script/route";
import { POST as reviewVoice } from "../../apps/studio/src/app/actions/review-voice/route";
import { POST as runChannelHandoff } from "../../apps/studio/src/app/actions/run-channel-handoff/route";
import { POST as runEstimate } from "../../apps/studio/src/app/actions/run-estimate/route";
import { POST as runEvidence } from "../../apps/studio/src/app/actions/run-evidence/route";
import { POST as runIdeas } from "../../apps/studio/src/app/actions/run-ideas/route";
import { POST as runPackage } from "../../apps/studio/src/app/actions/run-package/route";
import { POST as runReadiness } from "../../apps/studio/src/app/actions/run-readiness/route";
import { POST as runRenderPlan } from "../../apps/studio/src/app/actions/run-render-plan/route";
import { POST as runRender } from "../../apps/studio/src/app/actions/run-render/route";
import { POST as runReviewBundle } from "../../apps/studio/src/app/actions/run-review-bundle/route";
import { POST as runScript } from "../../apps/studio/src/app/actions/run-script/route";
import { POST as runVoice } from "../../apps/studio/src/app/actions/run-voice/route";
import { POST as analyzeSoundtrack } from "../../apps/studio/src/app/actions/soundtrack-analyze/route";
import { POST as decideSoundtrack } from "../../apps/studio/src/app/actions/soundtrack-decide/route";
import { POST as prepareSoundtrack } from "../../apps/studio/src/app/actions/soundtrack-prepare/route";
import { POST as decideVisuals } from "../../apps/studio/src/app/actions/visuals-decide/route";
import { POST as prepareVisuals } from "../../apps/studio/src/app/actions/visuals-prepare/route";
import { getStudioRunDetail } from "../../apps/studio/src/lib/runSummaries";
import { studioJsonRequest, studioSessionCookie } from "./product-uat-studio-http";

type StudioRouteHandler = (request: Request) => Promise<Response>;
type StudioActionPayload = {
  actionId?: string;
  message?: string;
  record?: unknown;
  status?: string;
};

let session = await studioSessionCookie(assert);

const ideas = await post(runIdeas, "/actions/run-ideas", "ideas.run", {});
const ideasRecord = recordObject(ideas);
const runId = stringField(ideasRecord, "runId");
const ideaId = firstIdeaId(ideasRecord);

await post(approveIdea, "/actions/approve-idea", "idea.approve", { ideaId, runId });
await post(runScript, "/actions/run-script", "script.run", { runId });
await post(reviewScript, "/actions/review-script", "script.review", { runId });
await post(approveScript, "/actions/approve-script", "script.approve", {
  acknowledgeWarnings: true,
  runId,
});
await post(runPackage, "/actions/run-package", "package.run", { runId });
await post(prepareVisuals, "/actions/visuals-prepare", "visuals.prepare", { runId });
const visualDetail = await getStudioRunDetail(runId);
assert(visualDetail !== null, "Studio reloads the prepared visual manifest.");
assert(visualDetail.visuals.kind === "ready", "Studio exposes prepared visuals for review.");
await post(decideVisuals, "/actions/visuals-decide", "visuals.decide", {
  expectedActiveRevisions: visualDetail.visuals.activeRevisions,
  expectedManifestDigest: visualDetail.visuals.manifestDigest,
  notes: "Approved deterministic visual fallback in Studio product UAT.",
  reviewedBy: "studio-workflow-uat",
  runId,
  sceneIndexes: visualDetail.visuals.scenes.map((scene) => scene.sceneIndex),
  status: "approved",
});
await post(runRenderPlan, "/actions/run-render-plan", "render-plan.run", { runId });
await post(reviewRenderPlan, "/actions/review-render-plan", "render-plan.review", { runId });
await post(runEstimate, "/actions/run-estimate", "estimate.run", { runId });
await post(runEvidence, "/actions/run-evidence", "evidence.run", { runId });

const readiness = await post(runReadiness, "/actions/run-readiness", "readiness.run", { runId });
assert(recordObject(readiness).passed === true, "Studio readiness route returns a passing record.");

session = await studioSessionCookie(assert);

await post(runVoice, "/actions/run-voice", "voice.run", { runId });
await post(reviewVoice, "/actions/review-voice", "voice.review", { runId });
await post(prepareSoundtrack, "/actions/soundtrack-prepare", "soundtrack.prepare", { runId });
let soundtrackDetail = await getStudioRunDetail(runId);
assert(soundtrackDetail !== null, "Studio reloads the prepared soundtrack manifest.");
assert(soundtrackDetail.soundtrack.kind === "ready", "Studio exposes soundtrack review evidence.");
await post(analyzeSoundtrack, "/actions/soundtrack-analyze", "soundtrack.analyze", {
  expectedManifestDigest: soundtrackDetail.soundtrack.digest,
  expectedRevision: soundtrackDetail.soundtrack.revision,
  runId,
});
soundtrackDetail = await getStudioRunDetail(runId);
assert(soundtrackDetail !== null, "Studio reloads the analyzed soundtrack manifest.");
assert(soundtrackDetail.soundtrack.kind === "ready", "Studio keeps soundtrack evidence current.");
assert(
  soundtrackDetail.soundtrack.analysis?.status === "complete",
  "Studio exposes completed soundtrack analysis before review.",
);
await post(decideSoundtrack, "/actions/soundtrack-decide", "soundtrack.decide", {
  expectedManifestDigest: soundtrackDetail.soundtrack.digest,
  expectedRevision: soundtrackDetail.soundtrack.revision,
  notes: "Approved voice-only soundtrack in Studio product UAT.",
  reviewedBy: "studio-workflow-uat",
  runId,
  status: "approved",
});
soundtrackDetail = await getStudioRunDetail(runId);
assert(soundtrackDetail !== null, "Studio reloads the reviewed soundtrack manifest.");
assert(
  soundtrackDetail.soundtrack.kind === "ready" &&
    soundtrackDetail.soundtrack.decision?.status === "approved",
  "Studio exposes the approved soundtrack decision before render approval.",
);
await post(approveRender, "/actions/approve-render", "render.approve", { runId });
await post(runRender, "/actions/run-render", "render.run", { runId });
await post(reviewRender, "/actions/review-render", "render.review", { runId });
await post(decideRender, "/actions/decide-render", "render.decide", {
  decision: "accepted-for-local-review",
  notes: "Product UAT completed the guarded Studio workflow path.",
  reviewedBy: "studio-workflow-uat",
  runId,
});
await post(runReviewBundle, "/actions/run-review-bundle", "review-bundle.run", { runId });
const handoff = await post(
  runChannelHandoff,
  "/actions/run-channel-handoff",
  "channel-handoff.run",
  { runId },
);
const handoffRecord = recordObject(handoff);
const thumbnailCandidates = objectField(handoffRecord, "thumbnailCandidates");
const thumbnailCandidateId = stringField(thumbnailCandidates, "recommendedCandidateId");
await post(decideChannelHandoff, "/actions/decide-channel-handoff", "channel-handoff.decide", {
  decision: "accepted-for-manual-channel-prep",
  notes: "Product UAT accepted the manual channel handoff package for operator prep.",
  reviewedBy: "studio-workflow-uat",
  runId,
  thumbnailCandidateId,
});
await post(runEvidence, "/actions/run-evidence", "evidence.run", { runId });
await post(runReadiness, "/actions/run-readiness", "readiness.run", { runId });

const detail = await getStudioRunDetail(runId);
assert(detail !== null, "Studio can reload the route-driven run.");
assert(detail.state === "RENDERED", "Studio route-driven run reaches RENDERED state.");
assert(detail.evidenceStatus === "available", "Studio route-driven run keeps current evidence.");
assert(detail.readinessStatus === "passed", "Studio route-driven run keeps passing readiness.");
assert(
  detail.renderDecision.kind === "present",
  "Studio route-driven run records a render decision.",
);
assert(
  detail.finalReviewBundle.kind === "present",
  "Studio route-driven run exposes a trusted final review bundle.",
);
assert(
  detail.channelHandoff.kind === "present",
  "Studio route-driven run exposes a trusted channel handoff.",
);
assert(
  detail.channelHandoffDecision.kind === "present",
  "Studio route-driven run records a channel handoff decision.",
);
assert(
  detail.channelHandoffDecision.kind === "present" &&
    detail.channelHandoffDecision.decision.selectedThumbnailCandidate?.candidateId ===
      thumbnailCandidateId,
  "Studio route-driven run keeps the selected thumbnail candidate.",
);
assert(
  detail.productionMedia.some((item) => item.label === "Draft render" && item.status === "pass"),
  "Studio route-driven run exposes a passing draft render.",
);

console.log(`Studio workflow action UAT passed. Run: ${runId}`);

async function post(
  handler: StudioRouteHandler,
  routePath: string,
  actionId: string,
  body: unknown,
): Promise<StudioActionPayload> {
  const response = await handler(studioJsonRequest(session, routePath, actionId, body));
  const payload = (await response.json().catch(() => null)) as StudioActionPayload | null;
  assert(
    response.status === 200,
    `${actionId} returned HTTP ${response.status}: ${payload?.message ?? "no response message"}.`,
  );
  assert(payload?.status === "ok", payload?.message ?? `${actionId} did not return ok.`);
  assert(payload.actionId === actionId, `${actionId} response action id matches.`);
  return payload;
}

function recordObject(payload: StudioActionPayload): Record<string, unknown> {
  assert(isObject(payload.record), "Studio action returned an object record.");
  return payload.record;
}

function objectField(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  assert(isObject(value), `Record field ${key} is an object.`);
  return value;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  assert(typeof value === "string" && value.length > 0, `Record field ${key} is a string.`);
  return value;
}

function firstIdeaId(record: Record<string, unknown>): string {
  const ideas = record.ideas;
  assert(Array.isArray(ideas) && ideas.length > 0, "Studio ideas route returns ideas.");
  const [firstIdea] = ideas;
  assert(isObject(firstIdea), "First idea is an object.");
  return stringField(firstIdea, "id");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Records a failed Studio workflow product UAT assertion.
 *
 * @param message - Failure message.
 * @returns Never returns.
 */
function fail(message: string): never {
  throw new Error(`Studio workflow product UAT failed: ${message}`);
}

/**
 * Asserts a Studio workflow product UAT condition.
 *
 * @param condition - Condition to validate.
 * @param message - Failure message.
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}
