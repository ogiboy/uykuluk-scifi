import { describe, expect, it } from "vitest";
import {
  buildStudioActionWorkbench,
  countStudioActionWorkbench,
  type StudioActionWorkbenchRun,
} from "../apps/studio/src/lib/studioActionWorkbench";

describe("Studio action workbench", () => {
  it("surfaces guarded approval routes without weakening CLI/core enforcement", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        nextRecommendedCommand: "pnpm producer approve idea --run run_workbench --idea idea_001",
        state: "IDEAS_GENERATED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer approve idea --run run_workbench --idea idea_001",
        label: "Approve Idea",
        routePath: "/actions/approve-idea",
        tone: "available",
      }),
    );
    expect(workbench.boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("Upload, scheduling, public publish"),
          label: "Disabled actions",
        }),
      ]),
    );
  });

  it("does not label unrelated remediation commands as approval CLI equivalents", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        nextRecommendedCommand: "pnpm producer evidence --run run_workbench",
        state: "SCRIPT_REVIEWED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: null,
        label: "Approve Script",
        routePath: "/actions/approve-script",
        tone: "available",
      }),
    );
  });

  it("selects the render decision route when local draft decision commands exist", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        renderDecisionCommands: [
          {
            command:
              "pnpm producer decide render --run run_workbench --decision accepted-for-local-review",
          },
        ],
        state: "RENDERED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command:
          "pnpm producer decide render --run run_workbench --decision accepted-for-local-review",
        label: "Record render decision",
        routePath: "/actions/decide-render",
        tone: "available",
      }),
    );
  });

  it("uses persisted render-decision next action when compact summaries lack command templates", () => {
    const nextAction =
      "pnpm producer decide render --run run_workbench --decision accepted-for-local-review";
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        renderDecision: { kind: "missing", nextAction },
        state: "RENDERED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: nextAction,
        label: "Record render decision",
        routePath: "/actions/decide-render",
        tone: "available",
      }),
    );
  });

  it("keeps blocked CLI-only next actions visible when no web route applies", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        blockedActionCount: 2,
        nextRecommendedCommand:
          "Regenerate evidence after manual recovery outside Studio for run_workbench",
        state: "FAILED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "Regenerate evidence after manual recovery outside Studio for run_workbench",
        label: "CLI next action",
        routePath: null,
        tone: "blocked",
      }),
    );
  });

  it("promotes safe workflow commands to guarded Studio routes", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        nextRecommendedCommand: "pnpm producer render-plan --run run_workbench",
        state: "PRODUCTION_PACKAGE_GENERATED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer render-plan --run run_workbench",
        label: "Generate Render Plan",
        routePath: "/actions/run-render-plan",
        tone: "available",
      }),
    );
  });

  it("prioritizes render-plan review over estimate when review artifacts exist", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        artifacts: [
          artifactPreview("production/render_plan.json"),
          artifactPreview("production/storyboard_contact_sheet.md"),
          artifactPreview("production/asset_provenance.json"),
        ],
        nextRecommendedCommand: "pnpm producer estimate --run run_workbench",
        state: "PRODUCTION_PACKAGE_GENERATED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer review render-plan --run run_workbench",
        label: "Review Render Plan",
        routePath: "/actions/review-render-plan",
        tone: "available",
      }),
    );
  });

  it("prioritizes voiceover review before render approval when audio handoff exists", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        artifacts: [
          artifactPreview("production/audio/voiceover.wav"),
          artifactPreview("production/audio/voiceover.meta.json"),
          artifactPreview("production/audio/voiceover_review.md"),
        ],
        nextRecommendedCommand: "pnpm producer approve render --run run_workbench",
        state: "READY_FOR_MANUAL_PRODUCTION",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer review voice --run run_workbench",
        label: "Review Voiceover",
        routePath: "/actions/review-voice",
        tone: "available",
      }),
    );
  });

  it("prioritizes draft-render review before recording a render decision", () => {
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        artifacts: [
          artifactPreview("production/render/draft.mp4"),
          artifactPreview("production/render/render_manifest.json"),
          artifactPreview("production/render/draft_review.md"),
        ],
        renderDecisionCommands: [
          {
            command:
              "pnpm producer decide render --run run_workbench --decision accepted-for-local-review",
          },
        ],
        state: "RENDERED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: "pnpm producer review render --run run_workbench",
        label: "Review Draft Render",
        routePath: "/actions/review-render",
        tone: "available",
      }),
    );
  });

  it("selects the local channel handoff decision route after handoff evidence is present", () => {
    const nextAction =
      "pnpm producer decide channel-handoff --run run_workbench --decision accepted-for-manual-channel-prep";
    const workbench = buildStudioActionWorkbench(
      actionRunFixture({
        channelHandoff: { kind: "present" },
        channelHandoffDecision: { kind: "missing", nextAction },
        nextRecommendedCommand: nextAction,
        state: "RENDERED",
      }),
    );

    expect(workbench.primary).toEqual(
      expect.objectContaining({
        command: nextAction,
        label: "Record channel handoff decision",
        routePath: "/actions/decide-channel-handoff",
        tone: "available",
      }),
    );
  });

  it("counts operator queue action categories", () => {
    expect(
      countStudioActionWorkbench([
        actionRunFixture({ state: "READY_FOR_MANUAL_PRODUCTION" }),
        actionRunFixture({
          blockedActionCount: 2,
          nextRecommendedCommand:
            "Resolve evidence manually; pnpm producer evidence --run run_workbench",
          state: "FAILED",
        }),
        actionRunFixture({
          nextRecommendedCommand: "Review state and ledger before continuing.",
          state: "RENDERED",
        }),
        actionRunFixture({
          renderDecision: {
            kind: "present",
            nextAction: "Local final review handoff is ready.",
          },
          state: "RENDERED",
        }),
      ]),
    ).toEqual({
      blockedCli: 1,
      cliOnly: 1,
      complete: 1,
      webAction: 1,
    });
  });
});

function actionRunFixture(
  overrides: Partial<StudioActionWorkbenchRun> = {},
): StudioActionWorkbenchRun {
  return {
    blockedActionCount: 0,
    channelHandoff: { kind: "missing" },
    channelHandoffDecision: { kind: "missing", nextAction: null },
    nextRecommendedCommand: null,
    readinessStatus: "passed",
    renderDecision: { kind: "missing", nextAction: null },
    renderDecisionCommands: [],
    runId: "run_workbench",
    state: "NEW",
    ...overrides,
  };
}

function artifactPreview(path: string): NonNullable<StudioActionWorkbenchRun["artifacts"]>[number] {
  return { exists: true, path };
}
