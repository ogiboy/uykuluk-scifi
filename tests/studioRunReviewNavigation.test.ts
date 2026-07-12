import { describe, expect, it } from "vitest";
import {
  defaultRunReviewTab,
  defaultRunReviewTabFromSummary,
  runReviewHref,
  runReviewHrefFromSummary,
  runReviewPathWithTab,
  runReviewTabFocus,
  runReviewTabFromSearchParams,
} from "../apps/studio/src/lib/runs/runReviewNavigation";
import { acceptedRenderDecision, runBriefFixture } from "./studioRunReviewBriefFixtures";

type SummaryNavigationFixture = Parameters<typeof defaultRunReviewTabFromSummary>[0];
type NavigationFixture = Parameters<typeof defaultRunReviewTab>[0] &
  Pick<SummaryNavigationFixture, "runId">;

function navigationFixture(overrides: Partial<NavigationFixture> = {}): NavigationFixture {
  const fixture: NavigationFixture = {
    artifactCount: 3,
    runId: "run_brief",
    ...runBriefFixture(),
    ...overrides,
  };
  return fixture;
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

  it("parses supported tab query params and rejects unsupported values", () => {
    expect(runReviewTabFromSearchParams({ tab: "media" }, "progress")).toBe("media");
    expect(runReviewTabFromSearchParams({ tab: ["handoff", "media"] }, "progress")).toBe("handoff");
    expect(runReviewTabFromSearchParams({ tab: "publish" }, "progress")).toBe("progress");
  });

  it("builds safe run-review links for queue navigation", () => {
    expect(runReviewHref("run_brief", "media")).toBe("/runs/run_brief?tab=media");
    expect(runReviewHref("run brief", "handoff", "review-decision")).toBe(
      "/runs/run%20brief?tab=handoff#review-decision",
    );
    expect(
      runReviewHrefFromSummary(
        navigationFixture({ blockedActionCount: 1, runId: "run needs attention" }),
      ),
    ).toBe("/runs/run%20needs%20attention?tab=readiness");
    expect(
      runReviewHrefFromSummary(navigationFixture({ runId: "run_final" }), "review-decision"),
    ).toBe("/runs/run_final?tab=media#review-decision");
  });

  it("updates the tab query while preserving unrelated query parameters", () => {
    expect(runReviewPathWithTab("/runs/run_brief", "panel=wide&tab=progress", "media")).toBe(
      "/runs/run_brief?panel=wide&tab=media",
    );
    expect(
      runReviewPathWithTab(
        "/runs/run_brief",
        new URLSearchParams("tab=progress&theme=dark"),
        "readiness",
        "review-decision",
      ),
    ).toBe("/runs/run_brief?tab=readiness&theme=dark#review-decision");
  });

  it("selects a useful tab from compact run summary data", () => {
    expect(
      defaultRunReviewTabFromSummary(
        navigationFixture({ artifactCount: 2, productionMedia: [], state: "SCRIPT_APPROVED" }),
      ),
    ).toBe("artifacts");
  });

  it("falls back to artifacts before progress when only local artifacts exist", () => {
    expect(
      defaultRunReviewTab(
        navigationFixture({ artifactCount: 2, productionMedia: [], state: "SCRIPT_APPROVED" }),
      ),
    ).toBe("artifacts");
  });

  it("keeps new empty runs on progress", () => {
    expect(
      defaultRunReviewTab(
        navigationFixture({ artifactCount: 0, productionMedia: [], state: "NEW" }),
      ),
    ).toBe("progress");
  });
});
