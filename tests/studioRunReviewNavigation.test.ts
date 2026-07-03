import { describe, expect, it } from "vitest";
import { defaultRunReviewTab, runReviewTabFocus } from "../apps/studio/src/lib/runReviewNavigation";
import { acceptedRenderDecision, runBriefFixture } from "./studioRunReviewBriefFixtures";

type NavigationFixture = Parameters<typeof defaultRunReviewTab>[0];

function navigationFixture(overrides: Partial<NavigationFixture> = {}): NavigationFixture {
  return {
    artifactCount: 3,
    ...runBriefFixture(),
    ...overrides,
  } as NavigationFixture;
}

describe("Studio run review navigation", () => {
  it("opens readiness when local production blockers need operator attention", () => {
    expect(
      defaultRunReviewTab(
        navigationFixture({
          blockedActionCount: 1,
          blockedActions: ["Regenerate evidence before trusting production media."],
        }),
      ),
    ).toBe("readiness");
  });

  it("opens media for rendered runs that need a durable local decision", () => {
    expect(defaultRunReviewTab(navigationFixture({ state: "RENDERED" }))).toBe("media");
    expect(runReviewTabFocus(navigationFixture({ state: "RENDERED" }))).toMatchObject({
      label: "Media review",
      tab: "media",
    });
  });

  it("opens handoff after a render decision or local handoff exists", () => {
    expect(
      defaultRunReviewTab(
        navigationFixture({
          renderDecision: {
            decision: acceptedRenderDecision(),
            kind: "present",
            message: "Render decision recorded: accepted-for-local-review.",
            nextAction: "pnpm producer review-bundle --run run_brief",
            reviewCommand: "pnpm producer review render-decision --run run_brief",
          },
          state: "RENDERED",
        }),
      ),
    ).toBe("handoff");
  });

  it("falls back to artifacts before progress when only local artifacts exist", () => {
    expect(
      defaultRunReviewTab(
        navigationFixture({
          artifactCount: 2,
          productionMedia: [],
          state: "SCRIPT_APPROVED",
        }),
      ),
    ).toBe("artifacts");
  });

  it("keeps new empty runs on progress", () => {
    expect(
      defaultRunReviewTab(
        navigationFixture({
          artifactCount: 0,
          productionMedia: [],
          state: "NEW",
        }),
      ),
    ).toBe("progress");
  });
});
