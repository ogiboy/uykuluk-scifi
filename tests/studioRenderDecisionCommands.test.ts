import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { readStudioRenderDecisionSummary } from "../apps/studio/src/lib/renderDecisionSummaries";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { renderDecisionJsonPath } from "../src/stages/renderDecisionCommands";
import { useTempProject } from "./helpers";
import { writeStudioRenderDecision } from "./studioRenderDecisionFixtures";
import { createRenderedStudioRunFixture, writeEvidence } from "./studioRunFixtures";

describe("Studio render decision commands", () => {
  useTempProject();

  it("shows local render decision commands for rendered runs without a recorded decision", async () => {
    const runId = await createRenderedStudioRunFixture();
    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecisionCommands).toEqual(
      expect.arrayContaining([
        {
          command: expect.stringContaining(`pnpm producer decide render --run ${runId}`),
          decision: "accepted-for-local-review",
          guidance: expect.stringContaining("complete local draft"),
        },
        {
          command: expect.stringContaining("--decision needs-revision"),
          decision: "needs-revision",
          guidance: expect.stringContaining("another pass"),
        },
        {
          command: expect.stringContaining("--decision rejected"),
          decision: "rejected",
          guidance: expect.stringContaining("should not be used"),
        },
      ]),
    );
  });

  it("hides local render decision commands after a decision artifact is recorded", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioRenderDecision(runId);

    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecisionCommands).toEqual([]);
    expect(detail?.renderDecision).toMatchObject({
      kind: "present",
      decision: {
        decision: "accepted-for-local-review",
        reviewedBy: "operator",
      },
    });
  });

  it("keeps local render decision commands hidden when a recorded decision artifact is missing", async () => {
    const runId = await createRenderedStudioRunFixture();
    const run = await loadRun(runId);
    await saveRun({
      ...run,
      artifacts: [...run.artifacts, "production/render/render_decision.json"],
    });

    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecisionCommands).toEqual([]);
    expect(detail?.renderDecision).toMatchObject({
      kind: "missing",
      message: "Render decision is listed in run artifacts but the JSON file is missing.",
    });
  });

  it("marks render decisions stale when run state or evidence no longer matches", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioRenderDecision(runId);
    const run = await loadRun(runId);
    await saveRun({ ...run, state: "ARCHIVED" });

    const archived = await getStudioRunDetail(runId);

    expect(archived?.renderDecision).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded, but the run is ARCHIVED.",
    });

    await saveRun(run);
    await writeEvidence(runId, {
      currentState: "RENDERED",
      draftRender: { status: "missing" },
    });

    const missingEvidence = await getStudioRunDetail(runId);

    expect(missingEvidence?.renderDecision).toMatchObject({
      kind: "stale",
      message: "Render decision requires current passing draft-render evidence.",
    });
  });

  it("marks render decisions stale when draft digest or approval binding changes", async () => {
    const digestRunId = await createRenderedStudioRunFixture();
    await writeStudioRenderDecision(digestRunId);
    await writeEvidence(digestRunId, {
      currentState: "RENDERED",
      draftRender: validDraftRenderEvidence({
        digest: "f".repeat(64),
        renderApproval: {
          approvalId: "approval_render_fixture",
          approvedRef: "d".repeat(64),
        },
      }),
    });

    const digestMismatch = await getStudioRunDetail(digestRunId);

    expect(digestMismatch?.renderDecision).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded for a different draft render digest.",
    });

    const approvalRunId = await createRenderedStudioRunFixture();
    await writeStudioRenderDecision(approvalRunId);
    await writeEvidence(approvalRunId, {
      currentState: "RENDERED",
      draftRender: validDraftRenderEvidence({
        digest: "a".repeat(64),
        renderApproval: {
          approvalId: "approval_other",
          approvedRef: "d".repeat(64),
        },
      }),
    });

    const approvalMismatch = await getStudioRunDetail(approvalRunId);

    expect(approvalMismatch?.renderDecision).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded for a different render approval.",
    });

    const refRunId = await createRenderedStudioRunFixture();
    await writeStudioRenderDecision(refRunId);
    await writeEvidence(refRunId, {
      currentState: "RENDERED",
      draftRender: validDraftRenderEvidence({
        digest: "a".repeat(64),
        renderApproval: {
          approvalId: "approval_render_fixture",
          approvedRef: "e".repeat(64),
        },
      }),
    });

    const approvalRefMismatch = await getStudioRunDetail(refRunId);

    expect(approvalRefMismatch?.renderDecision).toMatchObject({
      kind: "stale",
      message: "Render decision was recorded for a different render approval ref.",
    });
  });

  it("reports invalid render decision paths and malformed records", async () => {
    await expect(
      readStudioRenderDecisionSummary(process.cwd(), { runId: "../bad", state: "RENDERED" }, null),
    ).resolves.toMatchObject({
      kind: "invalid",
      message: "Render decision path is invalid.",
    });

    const runId = await createRenderedStudioRunFixture();
    await writeFile(
      artifactPath(runId, renderDecisionJsonPath),
      JSON.stringify({ schemaVersion: 1 }),
      "utf8",
    );

    const detail = await getStudioRunDetail(runId);

    expect(detail?.renderDecision).toMatchObject({
      kind: "invalid",
      message: expect.stringContaining("Render decision could not be trusted:"),
    });
  });
});

function validDraftRenderEvidence(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    bytes: 1024,
    digest: "a".repeat(64),
    durationSeconds: 8.2,
    ffmpegReviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
    mediaProbe: {
      audio: { codecName: "aac" },
      binary: "ffprobe",
      durationSeconds: 8.2,
      video: { height: 720, width: 1280 },
    },
    overlayRoles: ["watermark", "popup-card"],
    path: "production/render/draft.mp4",
    renderApproval: {
      approvalId: "approval_render_fixture",
      approvedRef: "d".repeat(64),
    },
    reviewChecklist: ["Review local draft only."],
    reviewPath: "production/render/draft_review.md",
    sourceFrameCadence: [
      "intro#1=1s assets/intro/frames/intro_frame_00.jpg",
      "intro#2=1s assets/intro/frames/intro_frame_01.jpg",
    ],
    sourceFrameCount: 2,
    sourceFrameSegments: ["intro:2"],
    status: "pass",
    timelineSegments: ["intro", "scene", "outro"],
    voiceoverMode: "local-piper",
    voiceoverProductionVoiceCandidate: true,
    voiceoverQuality: "local-piper",
    ...overrides,
  };
}
