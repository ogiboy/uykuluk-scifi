import { describe, expect, it } from "vitest";
import {
  buildStudioRunPrimaryAction,
  type StudioRunPrimaryActionRun,
} from "../apps/studio/src/lib/runPrimaryAction";

describe("Studio run primary action", () => {
  it("does not promote global ideas generation as a run-bound web action", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        nextRecommendedCommand: "pnpm producer ideas",
        state: "NEW",
      }),
    );

    expect(action).toMatchObject({
      command: null,
      label: "No run-bound action",
      mode: "complete",
      routePath: null,
      tone: "attention",
    });
  });

  it("promotes no-extra-input stage actions to inline web controls", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        nextRecommendedCommand: "pnpm producer render-plan --run run_primary_action",
        state: "PRODUCTION_PACKAGE_GENERATED",
      }),
    );

    expect(action).toMatchObject({
      label: "Generate Render Plan",
      mode: "stage",
      routePath: "/actions/run-render-plan",
      tone: "available",
    });
  });

  it("routes approval and decision forms to the action rail", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        nextRecommendedCommand: "pnpm producer approve idea --run run_primary_action --idea idea_1",
        state: "IDEAS_GENERATED",
      }),
    );

    expect(action).toMatchObject({
      label: "Approve Idea",
      mode: "rail",
      routePath: "/actions/approve-idea",
      tone: "available",
    });
  });

  it("does not confuse approval forms with unrelated stage remediation commands", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        nextRecommendedCommand: "pnpm producer evidence --run run_primary_action",
        state: "SCRIPT_REVIEWED",
      }),
    );

    expect(action).toMatchObject({
      command: null,
      label: "Approve Script",
      mode: "rail",
      routePath: "/actions/approve-script",
      tone: "available",
    });
  });

  it("routes artifact review handoffs to the action rail before state-changing follow-ups", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        artifacts: [
          artifactPreview("production/render_plan.json"),
          artifactPreview("production/storyboard_contact_sheet.md"),
          artifactPreview("production/asset_provenance.json"),
        ],
        nextRecommendedCommand: "pnpm producer estimate --run run_primary_action",
        state: "PRODUCTION_PACKAGE_GENERATED",
      }),
    );

    expect(action).toMatchObject({
      command: "pnpm producer review render-plan --run run_primary_action",
      label: "Review Render Plan",
      mode: "rail",
      routePath: "/actions/review-render-plan",
      tone: "available",
    });
  });

  it("keeps unknown safe commands copyable instead of inventing a web route", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        nextRecommendedCommand: "pnpm producer manual-check --run run_primary_action",
      }),
    );

    expect(action).toMatchObject({
      command: "pnpm producer manual-check --run run_primary_action",
      mode: "command",
      routePath: null,
      tone: "cli-only",
    });
  });

  it("does not surface upload or publish when the local review work is complete", () => {
    const action = buildStudioRunPrimaryAction(
      runPrimaryActionFixture({
        channelHandoffDecision: {
          kind: "present",
          nextAction: "Manual channel handoff decision is recorded.",
        },
        nextRecommendedCommand: null,
        renderDecision: {
          kind: "present",
          nextAction: "Local render decision is recorded.",
        },
      }),
    );

    expect(action).toMatchObject({
      command: null,
      mode: "complete",
      routePath: null,
      tone: "complete",
    });
  });
});

function runPrimaryActionFixture(
  overrides: Partial<StudioRunPrimaryActionRun> = {},
): StudioRunPrimaryActionRun {
  return {
    blockedActionCount: 0,
    channelHandoff: { kind: "missing" },
    channelHandoffDecision: { kind: "missing", nextAction: null },
    nextRecommendedCommand: null,
    readinessStatus: "passed",
    renderDecision: { kind: "missing", nextAction: null },
    renderDecisionCommands: [],
    runId: "run_primary_action",
    state: "NEW",
    ...overrides,
  };
}

function artifactPreview(
  path: string,
): NonNullable<StudioRunPrimaryActionRun["artifacts"]>[number] {
  return { exists: true, path };
}
