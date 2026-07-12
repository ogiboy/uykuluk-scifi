import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStudioLastMutationResult,
  parseStudioLastMutationResult,
  readStudioLastMutationResult,
  writeStudioLastMutationResult,
} from "../apps/studio/src/lib/mutations/studioLastMutationResult";

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

  it("normalizes bounded facts through the persisted schema", () => {
    const parsed = parseStudioLastMutationResult({
      actionId: "ideas.run",
      facts: [
        " first ",
        42,
        ...Array.from({ length: 9 }, (_, index) => `${index}-${"x".repeat(260)}`),
      ],
      kind: "success",
      message: "Idea run created.",
      recordedAtIso: "2026-07-05T11:36:14.000Z",
      refreshedPersistedState: true,
      routePath: "/actions/run-ideas",
      runId: "run_latest",
    });

    expect(parsed?.facts).toHaveLength(8);
    expect(parsed?.facts[0]).toBe("first");
    expect(parsed?.facts[1]).toHaveLength(240);
    expect(parsed?.facts.every((fact) => fact.length <= 240)).toBe(true);
  });

  it("rejects unknown fields and invalid HTTP statuses", () => {
    const valid = {
      actionId: "ideas.run",
      facts: [],
      kind: "success",
      message: "Idea run created.",
      recordedAtIso: "2026-07-05T11:36:14.000Z",
      refreshedPersistedState: true,
      routePath: "/actions/run-ideas",
      runId: "run_latest",
    } as const;

    expect(parseStudioLastMutationResult({ ...valid, extra: true })).toBeNull();
    expect(parseStudioLastMutationResult({ ...valid, status: 99 })).toBeNull();
    expect(parseStudioLastMutationResult({ ...valid, status: 600 })).toBeNull();
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
