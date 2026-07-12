import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCachedStudioMutationSession,
  readStudioMutationSessionSnapshot,
} from "../apps/studio/src/lib/mutations/studioMutationClient";
import {
  studioMutationFetchTimeoutMs,
  submitStudioJsonMutation,
} from "../apps/studio/src/lib/mutations/studioMutationSubmit";

const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("../apps/studio/src/lib/observability/studioObservability", () => ({
  captureStudioUnexpectedError: captureExceptionMock,
}));

const syntheticSessionToken = "TEST_ONLY_SESSION_TOKEN_1234567890";

describe("Studio mutation submit", () => {
  afterEach(() => {
    clearCachedStudioMutationSession();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("clears the cached local session after an unauthorized mutation response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
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
        Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
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
        Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            message: "Readiness is blocked.",
            record: { checks: [{ status: "block" }], passed: false, runId: "run_blocked_submit" },
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
      recordSummary: { facts: ["Run: run_blocked_submit"], runId: "run_blocked_submit" },
      status: 409,
    });
    expect(readStudioMutationSessionSnapshot()).toMatchObject({ status: "ready" });
  });

  it("returns a compact producer record summary after successful mutations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
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

  it("fails safely when the guarded route cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
        )
        .mockRejectedValueOnce(new TypeError("network unavailable")),
    );

    await expect(
      submitStudioJsonMutation({
        actionId: "script.run",
        body: { runId: "run_submit" },
        fallbackError: "Script generation could not run.",
        routePath: "/actions/run-script",
      }),
    ).resolves.toEqual({ kind: "error", message: "Script generation could not run." });
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(TypeError), {
      actionId: "script.run",
      boundary: "client-mutation",
      routePath: "/actions/run-script",
    });
    expect(JSON.stringify(captureExceptionMock.mock.calls)).not.toContain("run_submit");
  });

  it("distinguishes local JSON serialization failures from transport failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
        ),
    );
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await expect(
      submitStudioJsonMutation({
        actionId: "script.run",
        body: cyclic,
        fallbackError: "Script generation could not run.",
        routePath: "/actions/run-script",
      }),
    ).resolves.toEqual({ kind: "error", message: "Studio action payload is not valid JSON." });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("fails closed when a guarded mutation route exceeds its timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ expiresInSeconds: 900, status: "ok", token: syntheticSessionToken }),
        )
        .mockImplementationOnce(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) => {
              init.signal?.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError")),
              );
            }),
        ),
    );

    const result = submitStudioJsonMutation({
      actionId: "script.run",
      body: { runId: "run_timeout" },
      fallbackError: "Script generation timed out.",
      routePath: "/actions/run-script",
    });
    await vi.advanceTimersByTimeAsync(studioMutationFetchTimeoutMs);

    await expect(result).resolves.toEqual({
      kind: "error",
      message: "Script generation timed out.",
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(DOMException), {
      actionId: "script.run",
      boundary: "client-mutation",
      routePath: "/actions/run-script",
    });
  });
});
