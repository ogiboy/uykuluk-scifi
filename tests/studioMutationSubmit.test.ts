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
      status: 401,
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

    expect(result).toEqual({ kind: "error", message: "Run not found.", status: 409 });
    expect(readStudioMutationSessionSnapshot()).toMatchObject({ status: "ready" });
  });

  it("keeps the HTTP status when a producer record is returned from a blocked mutation", async () => {
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
            message: "Readiness is blocked.",
            record: {
              checks: [{ status: "block" }],
              passed: false,
              runId: "run_blocked_submit",
            },
            status: "error",
          },
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitStudioJsonMutation({
      actionId: "readiness.run",
      body: { runId: "run_blocked_submit" },
      fallbackError: "Readiness diagnostics could not run.",
      routePath: "/actions/run-readiness",
    });

    expect(result).toEqual({
      kind: "blocked",
      message: "Readiness is blocked.",
      recordSummary: {
        facts: ["Run: run_blocked_submit"],
        runId: "run_blocked_submit",
      },
      status: 409,
    });
    expect(readStudioMutationSessionSnapshot()).toMatchObject({ status: "ready" });
  });

  it("returns a compact producer record summary after successful mutations", async () => {
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
        Response.json({
          actionId: "script.revise",
          record: {
            artifact: "script.md",
            nextState: "SCRIPT_GENERATED",
            previousState: "SCRIPT_REVIEWED",
            revisionId: "revision_123",
            runId: "run_submit",
          },
          status: "ok",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitStudioJsonMutation({
      actionId: "script.revise",
      body: { runId: "run_submit" },
      fallbackError: "Script revision could not be recorded.",
      routePath: "/actions/revise-script",
    });

    expect(result).toEqual({
      kind: "success",
      recordSummary: {
        facts: [
          "State: SCRIPT_REVIEWED → SCRIPT_GENERATED",
          "Run: run_submit",
          "Artifact: script.md",
          "Revision: revision_123",
        ],
        runId: "run_submit",
      },
    });
  });
});
