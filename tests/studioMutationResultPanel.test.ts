import { describe, expect, it } from "vitest";
import { studioMutationRecoveryCopy } from "../apps/studio/src/lib/studioMutationRecoveryCopy";

describe("Studio mutation result panel copy", () => {
  it("routes local-session failures to the unauthorized recovery boundary", () => {
    expect(
      studioMutationRecoveryCopy({
        action: {
          actionId: "ideas.run",
          refreshedPersistedState: false,
          routePath: "/actions/run-ideas",
        },
        kind: "error",
        message: "Studio mutations require a valid local session token.",
        status: 401,
      }),
    ).toEqual({
      detail:
        "The guarded route rejected the local session token before running the action. No CLI/core command ran and no producer state changed.",
      href: "/unauthorized",
      label: "Open session recovery",
    });
  });

  it("routes same-origin failures to the forbidden recovery boundary", () => {
    expect(
      studioMutationRecoveryCopy({
        action: {
          actionId: "ideas.run",
          refreshedPersistedState: false,
          routePath: "/actions/run-ideas",
        },
        kind: "error",
        message: "Studio mutations require a trusted same-origin request.",
        status: 403,
      }),
    ).toEqual({
      detail:
        "The guarded route rejected the request boundary before running the action. No CLI/core command ran and no producer state changed.",
      href: "/forbidden",
      label: "Open request boundary details",
    });
  });

  it("keeps ordinary producer blockers on the current action panel", () => {
    expect(
      studioMutationRecoveryCopy({
        action: {
          actionId: "readiness.run",
          refreshedPersistedState: true,
          routePath: "/actions/run-readiness",
        },
        kind: "blocked",
        message: "Readiness is blocked.",
        recordSummary: null,
        status: 409,
      }),
    ).toBeNull();
  });
});
