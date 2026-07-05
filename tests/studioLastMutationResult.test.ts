import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStudioLastMutationResult,
  parseStudioLastMutationResult,
  readStudioLastMutationResult,
  writeStudioLastMutationResult,
} from "../apps/studio/src/lib/studioLastMutationResult";

describe("Studio last mutation result", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists a bounded same-session action notice", () => {
    installSessionStorage();

    writeStudioLastMutationResult({
      actionId: "ideas.run",
      facts: ["Run: run_latest", "Artifact: ideas.json"],
      kind: "success",
      message: "Idea run created.",
      recordedAtIso: "2026-07-05T11:36:14.000Z",
      refreshedPersistedState: true,
      routePath: "/actions/run-ideas",
      runId: "run_latest",
    });

    expect(readStudioLastMutationResult()).toEqual({
      actionId: "ideas.run",
      facts: ["Run: run_latest", "Artifact: ideas.json"],
      kind: "success",
      message: "Idea run created.",
      recordedAtIso: "2026-07-05T11:36:14.000Z",
      refreshedPersistedState: true,
      routePath: "/actions/run-ideas",
      runId: "run_latest",
      status: undefined,
    });
  });

  it("clears the action notice without touching producer state", () => {
    installSessionStorage();

    writeStudioLastMutationResult({
      actionId: "readiness.run",
      facts: [],
      kind: "blocked",
      message: "Readiness is blocked.",
      recordedAtIso: "2026-07-05T11:36:14.000Z",
      refreshedPersistedState: true,
      routePath: "/actions/run-readiness",
      runId: null,
      status: 409,
    });
    clearStudioLastMutationResult();

    expect(readStudioLastMutationResult()).toBeNull();
  });

  it("rejects malformed stored notices", () => {
    expect(parseStudioLastMutationResult({ actionId: "ideas.run", kind: "unknown" })).toBeNull();
    expect(parseStudioLastMutationResult({ actionId: "ideas.run", kind: "success" })).toBeNull();
  });
});

function installSessionStorage(): void {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
}
