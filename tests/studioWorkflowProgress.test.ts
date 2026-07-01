import { describe, expect, it } from "vitest";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import {
  writeStudioChannelHandoff,
  writeStudioFinalReviewBundle,
  writeStudioRenderDecision,
} from "./studioRenderDecisionFixtures";
import { createRenderedStudioRunFixture } from "./studioRunFixtures";
import { useTempProject } from "./helpers";

describe("Studio workflow progress", () => {
  useTempProject();

  it("shows read-only v1 workflow progress on rendered runs", async () => {
    const runId = await createRenderedStudioRunFixture();
    const detail = await getStudioRunDetail(runId);

    expect(detail?.workflowProgress).toEqual(
      expect.arrayContaining([
        {
          detail: "Verified by current evidence.",
          label: "Draft render",
          status: "done",
        },
        {
          detail: "Record the operator decision after local draft review.",
          label: "Operator decision",
          status: "current",
        },
        {
          detail: "Create the local final review handoff after recording the operator decision.",
          label: "Final review handoff",
          status: "pending",
        },
        {
          detail: "Prepare the manual channel package after accepted local final review.",
          label: "Manual channel handoff",
          status: "pending",
        },
      ]),
    );
  });

  it("marks Studio workflow operator decision done after a trusted local decision is recorded", async () => {
    const runId = await createRenderedStudioRunFixture();
    const decision = await writeStudioRenderDecision(runId, "accepted-for-local-review");
    const detail = await getStudioRunDetail(runId);

    expect(decision.nextSafeAction).toContain(`pnpm producer review-bundle --run ${runId}`);
    expect(detail?.nextRecommendedCommand).toBe(`pnpm producer review-bundle --run ${runId}`);
    expect(detail?.renderDecision).toMatchObject({
      kind: "present",
      message: "Render decision recorded: accepted-for-local-review.",
      reviewCommand: `pnpm producer review render-decision --run ${runId}`,
    });
    expect(detail?.workflowProgress).toEqual(
      expect.arrayContaining([
        {
          detail: "Render decision recorded: accepted-for-local-review.",
          label: "Operator decision",
          status: "done",
        },
        {
          detail: "Create the local final review handoff after recording the operator decision.",
          label: "Final review handoff",
          status: "current",
        },
      ]),
    );
  });

  it("surfaces the local final review bundle after operator decision handoff", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioFinalReviewBundle(runId, "accepted-for-local-review");
    const detail = await getStudioRunDetail(runId);

    expect(detail?.finalReviewBundle).toMatchObject({
      kind: "present",
      bundle: { status: "accepted-for-local-review" },
      reviewPath: "production/review_bundle.md",
    });
    expect(detail?.nextRecommendedCommand).toContain(
      `pnpm producer channel-handoff --run ${runId}`,
    );
    expect(detail?.nextRecommendedCommand).not.toContain("producer review-bundle");
    expect(detail?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exists: true,
          label: "Final review handoff",
          path: "production/review_bundle.md",
        }),
      ]),
    );
    expect(detail?.workflowProgress).toEqual(
      expect.arrayContaining([
        {
          detail: "Final review bundle ready: accepted-for-local-review.",
          label: "Final review handoff",
          status: "done",
        },
        {
          detail: "Prepare the manual channel package after accepted local final review.",
          label: "Manual channel handoff",
          status: "current",
        },
      ]),
    );
  });

  it("surfaces the completed manual channel handoff as the final local review action", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioChannelHandoff(runId);
    const detail = await getStudioRunDetail(runId);

    expect(detail?.channelHandoff).toMatchObject({
      kind: "present",
      handoff: { status: "ready-for-manual-channel-review" },
      reviewPath: "production/channel_handoff.md",
    });
    expect(detail?.nextRecommendedCommand).toContain(
      "Manually review production/channel_handoff.md",
    );
    expect(detail?.nextRecommendedCommand).not.toContain("producer channel-handoff");
    expect(detail?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exists: true,
          label: "Manual channel handoff",
          path: "production/channel_handoff.md",
        }),
      ]),
    );
    expect(detail?.workflowProgress).toEqual(
      expect.arrayContaining([
        {
          detail: "Manual channel handoff package is ready for local operator review.",
          label: "Manual channel handoff",
          status: "done",
        },
      ]),
    );
  });
});
