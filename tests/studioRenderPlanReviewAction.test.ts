import { describe, expect, it } from "vitest";
import {
  artifactReviewActionsForRun,
  draftRenderReviewCommand,
  renderPlanReviewActionForRun,
  renderPlanReviewCommand,
  type StudioRenderPlanReviewActionRun,
  voiceoverReviewCommand,
} from "../apps/studio/src/lib/actions/renderPlanReviewAction";

describe("Studio render-plan review action", () => {
  it("surfaces review when all render-plan handoff artifacts exist", () => {
    expect(
      renderPlanReviewActionForRun(
        renderPlanReviewRunFixture({
          artifacts: [
            artifactPreview("production/render_plan.json"),
            artifactPreview("production/storyboard_contact_sheet.md"),
            artifactPreview("production/asset_provenance.json"),
          ],
          nextRecommendedCommand: "pnpm producer estimate --run run_render_plan_review",
        }),
      ),
    ).toMatchObject({ actionId: "render-plan.review", routePath: "/actions/review-render-plan" });
  });

  it("does not duplicate the stage action when review is already the recommended command", () => {
    expect(
      renderPlanReviewActionForRun(
        renderPlanReviewRunFixture({
          artifacts: [
            artifactPreview("production/render_plan.json"),
            artifactPreview("production/storyboard_contact_sheet.md"),
            artifactPreview("production/asset_provenance.json"),
          ],
          nextRecommendedCommand: "pnpm producer review render-plan --run run_render_plan_review",
        }),
      ),
    ).toBeNull();
  });

  it("waits until every render-plan handoff artifact exists", () => {
    expect(
      renderPlanReviewActionForRun(
        renderPlanReviewRunFixture({
          artifacts: [
            artifactPreview("production/render_plan.json"),
            artifactPreview("production/storyboard_contact_sheet.md"),
          ],
        }),
      ),
    ).toBeNull();
  });

  it("materializes the copyable review command", () => {
    expect(renderPlanReviewCommand("run_render_plan_review")).toBe(
      "pnpm producer review render-plan --run run_render_plan_review",
    );
  });

  it("surfaces voiceover review when generated audio handoff artifacts exist", () => {
    expect(
      artifactReviewActionsForRun(
        renderPlanReviewRunFixture({
          artifacts: [
            artifactPreview("production/audio/voiceover.wav"),
            artifactPreview("production/audio/voiceover.meta.json"),
            artifactPreview("production/audio/voiceover_review.md"),
          ],
          nextRecommendedCommand: "pnpm producer voice --run run_render_plan_review",
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        actionId: "voice.review",
        command: "pnpm producer review voice --run run_render_plan_review",
      }),
    ]);
  });

  it("surfaces draft-render review when generated render handoff artifacts exist", () => {
    expect(
      artifactReviewActionsForRun(
        renderPlanReviewRunFixture({
          artifacts: [
            artifactPreview("production/render/draft.mp4"),
            artifactPreview("production/render/render_manifest.json"),
            artifactPreview("production/render/draft_review.md"),
          ],
          nextRecommendedCommand: "pnpm producer render --run run_render_plan_review",
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        actionId: "render.review",
        command: "pnpm producer review render --run run_render_plan_review",
      }),
    ]);
  });

  it("materializes voiceover and draft-render review commands", () => {
    expect(voiceoverReviewCommand("run_render_plan_review")).toBe(
      "pnpm producer review voice --run run_render_plan_review",
    );
    expect(draftRenderReviewCommand("run_render_plan_review")).toBe(
      "pnpm producer review render --run run_render_plan_review",
    );
  });
});

function renderPlanReviewRunFixture(
  overrides: Partial<StudioRenderPlanReviewActionRun> = {},
): StudioRenderPlanReviewActionRun {
  return {
    artifacts: [],
    nextRecommendedCommand: null,
    runId: "run_render_plan_review",
    state: "PRODUCTION_PACKAGE_GENERATED",
    ...overrides,
  };
}

function artifactPreview(path: string): StudioRenderPlanReviewActionRun["artifacts"][number] {
  return { exists: true, path };
}
