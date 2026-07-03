import { describe, expect, it } from "vitest";
import { buildStudioActionPreflight } from "../apps/studio/src/lib/studioActionPreflight";

describe("Studio action preflight", () => {
  it("surfaces selected idea payload and disabled upload boundary for guarded approvals", () => {
    const preflight = buildStudioActionPreflight({
      actionId: "idea.approve",
      run: actionRunFixture({ state: "IDEAS_GENERATED" }),
      selectedIdeaId: "idea_001",
    });

    expect(preflight.copy).toContain("local approval gate");
    expect(preflight.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("Selected idea idea_001"),
          label: "Payload",
          status: "done",
        }),
        expect.objectContaining({
          detail: expect.stringContaining("cannot upload"),
          label: "Upload / publish",
          status: "done",
        }),
      ]),
    );
  });

  it("keeps missing idea selection and stale evidence visible before submission", () => {
    const preflight = buildStudioActionPreflight({
      actionId: "idea.approve",
      run: actionRunFixture({
        evidenceMessage: "Evidence bundle is stale.",
        evidenceStatus: "stale",
      }),
      selectedIdeaId: "   ",
    });

    expect(preflight.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Payload",
          status: "attention",
        }),
        expect.objectContaining({
          detail: expect.stringContaining("Evidence bundle is stale."),
          label: "Evidence",
          status: "attention",
        }),
      ]),
    );
  });

  it("marks script warning acknowledgement without treating web preflight as enforcement", () => {
    const preflight = buildStudioActionPreflight({
      acknowledgeWarnings: false,
      actionId: "script.approve",
      run: actionRunFixture({ state: "SCRIPT_REVIEWED" }),
    });

    expect(preflight.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("core approval contract will reject"),
          label: "Warnings",
          status: "ready",
        }),
      ]),
    );
  });

  it("shows render decisions as local evidence only", () => {
    const preflight = buildStudioActionPreflight({
      actionId: "render.decide",
      run: actionRunFixture({ state: "RENDERED" }),
    });

    expect(preflight.copy).toContain("local render-review decision");
    expect(preflight.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("local review evidence only"),
          label: "Payload",
          status: "done",
        }),
      ]),
    );
  });

  it("shows channel handoff decisions as local evidence only", () => {
    const preflight = buildStudioActionPreflight({
      actionId: "channel-handoff.decide",
      run: actionRunFixture({ state: "RENDERED" }),
    });

    expect(preflight.copy).toContain("manual channel-handoff decision");
    expect(preflight.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("Upload and publish remain disabled"),
          label: "Payload",
          status: "done",
        }),
      ]),
    );
  });
});

function actionRunFixture(
  overrides: Partial<Parameters<typeof buildStudioActionPreflight>[0]["run"]> = {},
): Parameters<typeof buildStudioActionPreflight>[0]["run"] {
  return {
    blockedActionCount: 0,
    evidenceMessage: "Evidence is available.",
    evidenceStatus: "available",
    nextRecommendedCommand: "pnpm producer approve idea --run run_preflight --idea idea_001",
    readinessMessage: "Readiness passed.",
    readinessStatus: "passed",
    runId: "run_preflight",
    state: "IDEAS_GENERATED",
    ...overrides,
  };
}
