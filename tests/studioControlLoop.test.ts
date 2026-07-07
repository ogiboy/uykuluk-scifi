import { describe, expect, it } from "vitest";
import {
  buildStudioControlLoop,
  type StudioControlLoopRun,
} from "../apps/studio/src/lib/studioControlLoop";

describe("Studio control loop", () => {
  it("promotes guarded web actions as the primary Studio control path", () => {
    const loop = buildStudioControlLoop(
      controlLoopRunFixture({
        nextRecommendedCommand: "pnpm producer render-plan --run run_control_loop",
        state: "PRODUCTION_PACKAGE_GENERATED",
        workflowProgress: [
          {
            detail: "Generate and review the contact sheet.",
            label: "Render plan",
            status: "current",
          },
        ],
      }),
    );

    expect(loop).toMatchObject({
      currentStep: { label: "Render plan", status: "current" },
      nextAction: { label: "Generate Render Plan", routePath: "/actions/run-render-plan" },
      tone: "web-action",
    });
    expect(loop.summary).toContain("available from Studio");
  });

  it("keeps blocked evidence and readiness visible before continuing", () => {
    const loop = buildStudioControlLoop(
      controlLoopRunFixture({
        blockedActionCount: 2,
        evidenceMessage: "Evidence bundle is stale.",
        evidenceStatus: "stale",
        nextRecommendedCommand: "Regenerate evidence manually for run_control_loop",
        readinessMessage: "Readiness is blocked.",
        readinessStatus: "blocked",
        state: "FAILED",
        workflowProgress: [
          {
            detail: "Run failed before this gate completed.",
            label: "Script review",
            status: "blocked",
          },
        ],
      }),
    );

    expect(loop).toMatchObject({
      currentStep: { label: "Script review", status: "blocked" },
      tone: "blocked",
    });
    expect(loop.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Evidence", tone: "attention" }),
        expect.objectContaining({ label: "Blocked actions", tone: "blocked" }),
      ]),
    );
  });

  it("keeps upload and publish disabled when no immediate action remains", () => {
    const loop = buildStudioControlLoop(
      controlLoopRunFixture({
        channelHandoffDecision: {
          kind: "present",
          nextAction: "Manual channel handoff decision is recorded.",
        },
        nextRecommendedCommand: null,
        renderDecision: { kind: "present", nextAction: "Local render decision is recorded." },
        state: "RENDERED",
        workflowProgress: [{ detail: "Completed.", label: "Draft render", status: "done" }],
      }),
    );

    expect(loop).toMatchObject({
      nextAction: { command: null, routePath: null },
      tone: "complete",
    });
    expect(loop.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("Upload"),
          label: "Disabled actions",
          tone: "done",
        }),
      ]),
    );
  });
});

function controlLoopRunFixture(
  overrides: Partial<StudioControlLoopRun> = {},
): StudioControlLoopRun {
  return {
    blockedActionCount: 0,
    channelHandoff: { kind: "missing" },
    channelHandoffDecision: { kind: "missing", nextAction: null },
    evidenceMessage: "Evidence is available.",
    evidenceStatus: "available",
    nextRecommendedCommand: null,
    readinessMessage: "Readiness passed.",
    readinessStatus: "passed",
    renderDecision: { kind: "missing", nextAction: null },
    renderDecisionCommands: [],
    runId: "run_control_loop",
    state: "NEW",
    workflowProgress: [],
    ...overrides,
  };
}
