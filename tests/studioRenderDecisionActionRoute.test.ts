import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST } from "../apps/studio/src/app/actions/decide-render/route";
import {
  studioActionHeaderName,
  studioSessionCookieName,
  studioSessionHeaderName,
} from "../apps/studio/src/lib/studioMutationSecurity";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { renderDecisionJsonPath } from "../src/stages/renderDecisionCommands";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";
import {
  studioJsonMutationRequest,
  type StudioMutationRequestOptions,
  testStudioSessionToken,
} from "./studioMutationRouteTestHelpers";

describe("Studio render decision action route", () => {
  useTempProject();

  it("records local render-decision evidence through the guarded Studio route", async () => {
    const runId = await renderLocalDraft("studio-route-decision");

    const response = await POST(
      studioJsonRequest({
        decision: "accepted-for-local-review",
        notes: "Timing, voiceover, and overlays are acceptable for local review.",
        reviewedBy: "operator",
        runId,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actionId: "render.decide",
      record: {
        decision: "accepted-for-local-review",
        reviewedBy: "operator",
        runId,
      },
      status: "ok",
    });
    const run = await loadRun(runId);
    expect(run.artifacts).toContain(renderDecisionJsonPath);
    await expect(readFile(artifactPath(runId, renderDecisionJsonPath), "utf8")).resolves.toContain(
      "accepted-for-local-review",
    );
  });

  it("rejects unsafe or malformed Studio mutation requests before core execution", async () => {
    await expectRouteError(studioJsonRequest({}, { actionHeader: "" }), 403);
    await expectRouteError(
      studioJsonRequest(
        {},
        {
          origin: "https://attacker.example",
        },
      ),
      403,
    );
    await expectRouteError(
      new Request("http://localhost:3000/actions/decide-render", {
        body: "decision=accepted-for-local-review",
        headers: {
          [studioActionHeaderName]: "render.decide",
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
        decision: "accepted-for-local-review",
        notes: "Path traversal should fail.",
        reviewedBy: "operator",
        runId: "../escape",
      }),
      400,
    );
    await expectRouteError(
      studioJsonRequest({
        decision: "accepted-for-local-review",
        extra: true,
        notes: "Unknown fields should fail.",
        reviewedBy: "operator",
        runId: "run_unknown_field",
      }),
      400,
    );
    await expectRouteError(studioJsonRequest({}, { sessionToken: null }), 401);
    await expectRouteError(
      studioJsonRequest({}, { cookieToken: "other_session_token_1234567890ABCDEFGH" }),
      401,
    );
  });

  it("maps core render-decision blockers to a conflict response", async () => {
    const response = await POST(
      studioJsonRequest({
        decision: "needs-revision",
        notes: "No rendered draft exists.",
        reviewedBy: "operator",
        runId: "run_missing_draft",
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
 * Builds a same-origin JSON request for the Studio render-decision route.
 *
 * @param body - The JSON request payload.
 * @param options - Header overrides for negative security tests.
 * @returns A Request object suitable for calling the route handler directly.
 */
function studioJsonRequest(body: unknown, options: StudioMutationRequestOptions = {}): Request {
  return studioJsonMutationRequest("/actions/decide-render", "render.decide", body, options);
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
