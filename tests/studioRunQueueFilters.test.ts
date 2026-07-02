import { describe, expect, it } from "vitest";
import {
  countStudioRunQueueFilters,
  filterStudioRunQueue,
} from "../apps/studio/src/lib/runQueueFilters";
import { applyRunQueueWorkbenchControls } from "../apps/studio/src/lib/runQueueWorkbench";
import type { StudioRunSummary } from "../apps/studio/src/lib/runSummaries";

describe("Studio run queue filters", () => {
  const runs = [
    runSummary({
      blockedActionCount: 2,
      evidenceStatus: "available",
      readinessStatus: "passed",
      runId: "run_blocked",
      state: "RENDERED",
    }),
    runSummary({
      evidenceStatus: "missing",
      nextRecommendedCommand: "pnpm producer evidence --run run_missing",
      readinessStatus: "missing",
      runId: "run_missing",
      state: "SCRIPT_REVIEWED",
    }),
    runSummary({
      evidenceStatus: "available",
      readinessStatus: "passed",
      renderDecision: { kind: "missing", message: "No render decision.", nextAction: null },
      runId: "run_needs_decision",
      state: "RENDERED",
    }),
    runSummary({
      evidenceStatus: "available",
      readinessStatus: "passed",
      runId: "run_ready",
      state: "READY_FOR_MANUAL_PRODUCTION",
    }),
  ];

  it("counts operator queue categories from persisted run summaries", () => {
    expect(countStudioRunQueueFilters(runs)).toEqual({
      all: 4,
      attention: 2,
      decision: 1,
      ready: 2,
      rendered: 2,
    });
  });

  it("filters by attention, readiness, rendered state, and missing decision", () => {
    expect(
      filterStudioRunQueue(runs, { filter: "attention", query: "" }).map((run) => run.runId),
    ).toEqual(["run_blocked", "run_missing"]);
    expect(
      filterStudioRunQueue(runs, { filter: "ready", query: "" }).map((run) => run.runId),
    ).toEqual(["run_needs_decision", "run_ready"]);
    expect(
      filterStudioRunQueue(runs, { filter: "rendered", query: "" }).map((run) => run.runId),
    ).toEqual(["run_blocked", "run_needs_decision"]);
    expect(
      filterStudioRunQueue(runs, { filter: "decision", query: "" }).map((run) => run.runId),
    ).toEqual(["run_needs_decision"]);
  });

  it("combines selected filters with case-insensitive run search", () => {
    expect(
      filterStudioRunQueue(runs, { filter: "all", query: "EVIDENCE" }).map((run) => run.runId),
    ).toEqual(["run_missing"]);
    expect(
      filterStudioRunQueue(runs, { filter: "ready", query: "manual" }).map((run) => run.runId),
    ).toEqual(["run_ready"]);
  });

  it("applies operator workbench controls without mutating persisted run order", () => {
    expect(
      applyRunQueueWorkbenchControls(runs, {
        maxBlockedActions: 0,
        sort: "decision-first",
      }).map((run) => run.runId),
    ).toEqual(["run_needs_decision", "run_missing", "run_ready"]);
    expect(
      applyRunQueueWorkbenchControls(runs, {
        maxBlockedActions: 5,
        sort: "blocked-first",
      }).map((run) => run.runId),
    ).toEqual(["run_blocked", "run_needs_decision", "run_missing", "run_ready"]);
    expect(runs.map((run) => run.runId)).toEqual([
      "run_blocked",
      "run_missing",
      "run_needs_decision",
      "run_ready",
    ]);
  });
});

function runSummary(overrides: Partial<StudioRunSummary>): StudioRunSummary {
  return {
    approvalCount: 0,
    artifactCount: 0,
    blockedActions: [],
    blockedActionCount: 0,
    channelHandoff: { kind: "missing", message: "Missing." },
    channelHandoffDecision: { kind: "missing", message: "Missing." },
    createdAt: "2026-07-02T00:00:00.000Z",
    evidenceMessage: "Evidence is available.",
    evidenceStatus: "available",
    finalReviewBundle: { kind: "missing", message: "Missing." },
    nextRecommendedCommand: "pnpm producer approve render --run run_ready",
    readinessMessage: "Readiness passed.",
    readinessPassed: true,
    readinessStatus: "passed",
    renderDecision: {
      decision: {
        createdAt: "2026-07-02T00:00:00.000Z",
        decision: "accepted-for-local-review",
        reviewedBy: "operator",
      },
      kind: "present",
      message: "Accepted.",
    },
    runId: "run_ready",
    state: "READY_FOR_MANUAL_PRODUCTION",
    updatedAt: "2026-07-02T00:00:00.000Z",
    warningCount: 0,
    workflowProgress: [],
    ...overrides,
  } as StudioRunSummary;
}
