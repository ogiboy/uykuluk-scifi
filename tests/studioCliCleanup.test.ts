import { describe, expect, it, vi } from "vitest";
import { runStudioCliMutationRoute } from "../apps/studio/src/lib/mutations/studioCliMutation";
import { studioJsonMutationRequest } from "./studioMutationRouteTestHelpers";

const captureUnexpectedError = vi.hoisted(() => vi.fn());

vi.mock("../apps/studio/src/lib/observability/studioObservability", () => ({
  captureStudioUnexpectedError: captureUnexpectedError,
}));

describe("Studio CLI cleanup handling", () => {
  it("preserves a committed successful CLI result when temporary cleanup fails", async () => {
    const cleanupError = new Error("cleanup failed");
    const response = await runStudioCliMutationRoute(
      studioJsonMutationRequest("/actions/run-script", "script.run", {
        runId: "run_cleanup_success",
      }),
      "script.run",
      {
        prepareCli: async () => ({
          args: ["script", "--run", "run_cleanup_success", "--json"],
          cleanup: async () => {
            throw cleanupError;
          },
        }),
        runCli: async () => ({
          status: 0,
          stderr: "",
          stdout: JSON.stringify({ runId: "run_cleanup_success", state: "SCRIPT_GENERATED" }),
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      actionId: "script.run",
      record: { runId: "run_cleanup_success", state: "SCRIPT_GENERATED" },
      status: "ok",
      warnings: [
        "The producer CLI finished, but Studio could not remove every temporary input file.",
      ],
    });
    expect(captureUnexpectedError).toHaveBeenCalledWith(cleanupError, {
      actionId: "script.run",
      boundary: "route-mutation",
      routePath: "/actions/run-script",
    });
  });

  it("reports both the CLI execution and cleanup failures", async () => {
    const runError = new Error("spawn failed");
    const cleanupError = new Error("cleanup failed");
    const response = await runStudioCliMutationRoute(
      studioJsonMutationRequest("/actions/run-script", "script.run", {
        runId: "run_cleanup_failure",
      }),
      "script.run",
      {
        prepareCli: async () => ({
          args: ["script", "--run", "run_cleanup_failure", "--json"],
          cleanup: async () => {
            throw cleanupError;
          },
        }),
        runCli: async () => {
          throw runError;
        },
      },
    );

    expect(response.status).toBe(500);
    const captured = captureUnexpectedError.mock.calls.at(-1)?.[0];
    expect(captured).toBeInstanceOf(AggregateError);
    expect((captured as AggregateError).errors).toEqual([runError, cleanupError]);
  });
});
