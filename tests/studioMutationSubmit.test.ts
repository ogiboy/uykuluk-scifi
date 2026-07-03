import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCachedStudioMutationSession,
  readStudioMutationSessionSnapshot,
} from "../apps/studio/src/lib/studioMutationClient";
import { submitStudioJsonMutation } from "../apps/studio/src/lib/studioMutationSubmit";

describe("Studio mutation submit", () => {
  afterEach(() => {
    clearCachedStudioMutationSession();
    vi.unstubAllGlobals();
  });

  it("clears the cached local session after an unauthorized mutation response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          expiresInSeconds: 900,
          status: "ok",
          token: "session_token_submit_1234567890",
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            message:
              "Studio mutations require a valid local session token. Refresh the local web control session before retrying.",
          },
          { status: 401 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitStudioJsonMutation({
      actionId: "render.decide",
      body: { runId: "run_submit" },
      fallbackError: "Render decision could not be recorded.",
      routePath: "/actions/decide-render",
    });

    expect(result).toEqual({
      kind: "error",
      message:
        "Studio mutations require a valid local session token. Refresh the local web control session before retrying.",
    });
    expect(readStudioMutationSessionSnapshot()).toEqual({ status: "missing" });
  });

  it("reuses the cached local session after non-auth mutation failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          expiresInSeconds: 900,
          status: "ok",
          token: "session_token_submit_1234567890",
        }),
      )
      .mockResolvedValueOnce(Response.json({ message: "Run not found." }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitStudioJsonMutation({
      actionId: "script.approve",
      body: { runId: "run_missing" },
      fallbackError: "Approval could not be recorded.",
      routePath: "/actions/approve-script",
    });

    expect(result).toEqual({ kind: "error", message: "Run not found." });
    expect(readStudioMutationSessionSnapshot()).toMatchObject({ status: "ready" });
  });
});
