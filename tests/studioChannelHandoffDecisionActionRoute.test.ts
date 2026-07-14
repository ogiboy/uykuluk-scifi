import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST } from "../apps/studio/src/app/actions/decide-channel-handoff/route";
import {
  studioActionHeaderName,
  studioSessionCookieName,
  studioSessionHeaderName,
} from "../apps/studio/src/lib/mutations/studioMutationSecurityContracts";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { createChannelHandoff } from "../src/stages/channelHandoff";
import { channelHandoffDecisionJsonPath } from "../src/stages/channelHandoffDecision";
import { createFinalReviewBundle } from "../src/stages/finalReviewBundle";
import { recordRenderDecision } from "../src/stages/renderDecision";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";
import {
  studioJsonMutationRequest,
  type StudioMutationRequestOptions,
  testStudioSessionToken,
} from "./studioMutationRouteTestHelpers";

describe("Studio channel handoff decision action route", () => {
  useTempProject();

  it("records local channel-handoff decision evidence through the guarded Studio route", async () => {
    const runId = await acceptedChannelHandoffRun("studio-route-channel-handoff");
    const handoff = await createChannelHandoff(runId);

    const response = await POST(
      studioJsonRequest({
        decision: "accepted-for-manual-channel-prep",
        notes: "Metadata, chapters, MP4, and thumbnail candidate are ready for manual prep.",
        reviewedBy: "operator",
        runId,
        thumbnailCandidateId: handoff.thumbnailCandidates.recommendedCandidateId,
      }),
    );

    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({
      actionId: "channel-handoff.decide",
      record: {
        decision: "accepted-for-manual-channel-prep",
        reviewedBy: "operator",
        runId,
        selectedThumbnailCandidate: {
          candidateId: handoff.thumbnailCandidates.recommendedCandidateId,
        },
      },
      status: "ok",
    });
    const run = await loadRun(runId);
    expect(run.artifacts).toContain(channelHandoffDecisionJsonPath);
    await expect(
      readFile(artifactPath(runId, channelHandoffDecisionJsonPath), "utf8"),
    ).resolves.toContain("accepted-for-manual-channel-prep");
  });

  it("rejects unsafe or malformed Studio mutation requests before core execution", async () => {
    await expectRouteError(studioJsonRequest({}, { actionHeader: "" }), 403);
    await expectRouteError(studioJsonRequest({}, { origin: "https://attacker.example" }), 403);
    await expectRouteError(
      new Request("http://localhost:3000/actions/decide-channel-handoff", {
        body: "decision=accepted-for-manual-channel-prep",
        headers: {
          [studioActionHeaderName]: "channel-handoff.decide",
          [studioSessionHeaderName]: testStudioSessionToken,
          cookie: `${studioSessionCookieName}=${testStudioSessionToken}`,
          "content-type": "application/x-www-form-urlencoded",
          origin: "http://localhost:3000",
        },
        method: "POST",
      }),
      415,
    );
    await expectRouteError(
      studioJsonRequest({
        decision: "accepted-for-manual-channel-prep",
        notes: "Path traversal should fail.",
        reviewedBy: "operator",
        runId: "../escape",
        thumbnailCandidateId: "thumbnail-01-left",
      }),
      400,
    );
    await expectRouteError(
      studioJsonRequest({
        decision: "accepted-for-manual-channel-prep",
        notes: "Accepted decisions require a thumbnail candidate.",
        reviewedBy: "operator",
        runId: "run_missing_thumbnail",
      }),
      400,
    );
    await expectRouteError(studioJsonRequest({}, { sessionToken: null }), 401);
    await expectRouteError(
      studioJsonRequest({}, { cookieToken: "other_session_token_1234567890ABCDEFGH" }),
      401,
    );
  });

  it("maps core channel-handoff blockers to a conflict response", async () => {
    const response = await POST(
      studioJsonRequest({
        decision: "needs-revision",
        notes: "No channel handoff exists.",
        reviewedBy: "operator",
        runId: "run_missing_channel_handoff",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("Run not found"),
      status: "error",
    });
  });
});

/**
 * Builds a same-origin JSON request for the Studio channel-handoff decision route.
 *
 * @param body - The JSON request payload.
 * @param options - Header overrides for negative security tests.
 * @returns A Request object suitable for calling the route handler directly.
 */
function studioJsonRequest(body: unknown, options: StudioMutationRequestOptions = {}): Request {
  return studioJsonMutationRequest(
    "/actions/decide-channel-handoff",
    "channel-handoff.decide",
    body,
    options,
  );
}

/**
 * Asserts that the route rejects a request with the expected HTTP status.
 *
 * @param request - The request sent to the route.
 * @param status - The expected HTTP status.
 */
async function expectRouteError(request: Request, status: number): Promise<void> {
  const response = await POST(request);
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "error" });
}

async function acceptedChannelHandoffRun(scope: string): Promise<string> {
  const runId = await renderLocalDraft(scope);
  await recordRenderDecision({
    decision: "accepted-for-local-review",
    notes: "Draft is acceptable for local channel review.",
    reviewedBy: "operator",
    runId,
  });
  await createFinalReviewBundle(runId);
  return runId;
}
