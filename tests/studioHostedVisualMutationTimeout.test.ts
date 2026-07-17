import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCachedStudioMutationSession } from "../apps/studio/src/lib/mutations/studioMutationClient";
import {
  hostedVisualMutationFetchTimeoutMs,
  studioMutationFetchTimeoutForAction,
  submitStudioJsonMutation,
} from "../apps/studio/src/lib/mutations/studioMutationSubmit";

const syntheticSessionToken = "TEST_ONLY_SESSION_TOKEN_1234567890";

describe("Studio hosted visual mutation timeout", () => {
  afterEach(() => {
    clearCachedStudioMutationSession();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps hosted execution within its bounded provider window", () => {
    expect(studioMutationFetchTimeoutForAction("visuals.generate-hosted")).toBe(
      hostedVisualMutationFetchTimeoutMs,
    );
  });

  it("reports a timeout as reconciliation-pending", async () => {
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
      actionId: "visuals.generate-hosted",
      body: { runId: "run_hosted_timeout" },
      fallbackError: "Hosted generation failed.",
      routePath: "/actions/visuals-generate-hosted",
    });
    await vi.advanceTimersByTimeAsync(hostedVisualMutationFetchTimeoutMs);

    await expect(result).resolves.toMatchObject({
      kind: "error",
      message: expect.stringMatching(/may still require reconciliation/i),
    });
  });
});
