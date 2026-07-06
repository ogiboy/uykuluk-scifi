import { describe, expect, it } from "vitest";
import {
  countStudioRunQueueFilters,
  filterStudioRunQueue,
} from "../apps/studio/src/lib/runQueueFilters";
import {
  applyRunQueueWorkbenchControls,
  runQueueEmptyState,
} from "../apps/studio/src/lib/runQueueWorkbench";
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
      channelHandoff: {
        handoff: {
          createdAt: "2026-07-02T00:00:00.000Z",
          blockedActions: ["Upload and publish remain disabled."],
          finalReviewBundle: {
            digest: "a".repeat(64),
            markdownPath: "production/review_bundle.md",
            path: "production/review_bundle.json",
            status: "accepted-for-local-review",
          },
          manualOnly: true,
          media: {
            chaptersJsonPath: "production/render/youtube_chapters.json",
            chaptersPath: "production/render/youtube_chapters.md",
            draftRenderPath: "production/render/draft.mp4",
            draftRenderSha256: "b".repeat(64),
            durationSeconds: 8.2,
            renderReviewPath: "production/render/draft_review.md",
            subtitlesPath: "production/subtitles.srt",
          },
          nextSafeAction: "Review local channel handoff before any future private upload.",
          operatorChecklist: ["Watch the draft MP4 from start to finish."],
          runId: "run_channel_decision",
          schemaVersion: 2,
          status: "ready-for-manual-channel-review",
          thumbnailCandidates: {
            jsonPath: "production/thumbnail_candidates.json",
            jsonSha256: "c".repeat(64),
            markdownPath: "production/thumbnail_candidates.md",
            markdownSha256: "d".repeat(64),
            recommendedCandidateId: "thumb_01",
          },
          youtube: {
            description: "Fixture description.",
            metadataPath: "production/youtube_metadata.json",
            tags: ["uykuluk", "scifi"],
            title: "Fixture title",
          },
        },
        kind: "present",
        message: "Channel handoff exists.",
        nextAction: "pnpm producer decide channel-handoff --run run_channel_decision",
        reviewPath: "production/channel_handoff.md",
      },
      channelHandoffDecision: {
        kind: "missing",
        message: "No channel handoff decision.",
        nextAction: "pnpm producer decide channel-handoff --run run_channel_decision",
      },
      evidenceStatus: "available",
      nextRecommendedCommand: "pnpm producer decide channel-handoff --run run_channel_decision",
      readinessStatus: "passed",
      runId: "run_channel_decision",
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
      all: 5,
      attention: 2,
      decision: 2,
      ready: 3,
      rendered: 3,
    });
  });

  it("filters by attention, readiness, rendered state, and missing decision", () => {
    expect(
      filterStudioRunQueue(runs, { filter: "attention", query: "" }).map((run) => run.runId),
    ).toEqual(["run_blocked", "run_missing"]);
    expect(
      filterStudioRunQueue(runs, { filter: "ready", query: "" }).map((run) => run.runId),
    ).toEqual(["run_needs_decision", "run_channel_decision", "run_ready"]);
    expect(
      filterStudioRunQueue(runs, { filter: "rendered", query: "" }).map((run) => run.runId),
    ).toEqual(["run_blocked", "run_needs_decision", "run_channel_decision"]);
    expect(
      filterStudioRunQueue(runs, { filter: "decision", query: "" }).map((run) => run.runId),
    ).toEqual(["run_needs_decision", "run_channel_decision"]);
  });

  it("combines selected filters with case-insensitive run search", () => {
    expect(
      filterStudioRunQueue(runs, { filter: "all", query: "EVIDENCE" }).map((run) => run.runId),
    ).toEqual(["run_missing"]);
    expect(
      filterStudioRunQueue(runs, { filter: "ready", query: "manual" }).map((run) => run.runId),
    ).toEqual(["run_channel_decision", "run_ready"]);
    expect(
      filterStudioRunQueue(runs, { filter: "ready", query: "actions/approve-render" }).map(
        (run) => run.runId,
      ),
    ).toEqual(["run_ready"]);
  });

  it("applies operator workbench controls without mutating persisted run order", () => {
    expect(
      applyRunQueueWorkbenchControls(runs, {
        maxBlockedActions: 0,
        sort: "decision-first",
      }).map((run) => run.runId),
    ).toEqual(["run_channel_decision", "run_needs_decision", "run_missing", "run_ready"]);
    expect(
      applyRunQueueWorkbenchControls(runs, {
        maxBlockedActions: 5,
        sort: "blocked-first",
      }).map((run) => run.runId),
    ).toEqual([
      "run_blocked",
      "run_channel_decision",
      "run_needs_decision",
      "run_missing",
      "run_ready",
    ]);
    expect(runs.map((run) => run.runId)).toEqual([
      "run_blocked",
      "run_missing",
      "run_needs_decision",
      "run_channel_decision",
      "run_ready",
    ]);
  });

  it("distinguishes an empty run store from filtered-away queue views", () => {
    expect(runQueueEmptyState(0, 0, 0)).toEqual({
      heading: "No runs yet",
      message: "Use the Start idea run control to create the first local production run.",
    });
    expect(runQueueEmptyState(4, 0, 0)).toEqual({
      heading: "No matching runs",
      message: "Clear the search text or choose a broader run filter.",
    });
    expect(runQueueEmptyState(4, 2, 0)).toEqual({
      heading: "All matching runs are hidden",
      message: "Raise the blocker limit or reset the queue view to show matching runs.",
    });
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
