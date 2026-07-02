import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { channelHandoffJsonPath } from "../src/stages/channelHandoffContracts";
import { channelHandoffDecisionJsonPath } from "../src/stages/channelHandoffDecision";
import type { StatusWorkflowStep } from "../src/stages/statusWorkflow";
import {
  writeStudioFinalReviewBundle,
  writeStudioRenderDecision,
} from "./studioRenderDecisionFixtures";
import {
  writeStudioChannelHandoff,
  writeStudioChannelHandoffDecision,
} from "./studioChannelHandoffFixtures";
import { createRenderedStudioRunFixture } from "./studioRunFixtures";
import { useTempProject } from "./helpers";

describe("Studio workflow progress", () => {
  useTempProject();

  it("shows read-only v1 workflow progress on rendered runs", async () => {
    const runId = await createRenderedStudioRunFixture();
    const detail = await getStudioRunDetail(runId);

    expectWorkflowSteps(detail?.workflowProgress, [
      ["Draft render", "done"],
      ["Operator decision", "current"],
      ["Final review handoff", "pending"],
      ["Manual channel handoff", "pending"],
    ]);
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
    expectWorkflowSteps(detail?.workflowProgress, [
      ["Operator decision", "done"],
      ["Final review handoff", "current"],
      ["Manual channel handoff", "pending"],
    ]);
  });

  it("surfaces the local final review bundle after operator decision handoff", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioFinalReviewBundle(runId, "accepted-for-local-review");
    const detail = await getStudioRunDetail(runId);

    expect(detail?.finalReviewBundle).toMatchObject({
      kind: "present",
      bundle: {
        draftRender: { reviewPath: "production/render/draft_review.md" },
        status: "accepted-for-local-review",
      },
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
    expectWorkflowSteps(detail?.workflowProgress, [
      ["Operator decision", "done"],
      ["Final review handoff", "done"],
      ["Manual channel handoff", "current"],
    ]);
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
    expect(detail?.channelHandoffDecision).toMatchObject({
      kind: "missing",
      message: "Manual channel-handoff decision has not been recorded.",
    });
    expect(detail?.nextRecommendedCommand).toContain("pnpm producer decide channel-handoff");
    expect(detail?.nextRecommendedCommand).toContain("--thumbnail-candidate <candidate_id>");
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
    expectWorkflowSteps(detail?.workflowProgress, [
      ["Operator decision", "done"],
      ["Final review handoff", "done"],
      ["Manual channel handoff", "done"],
    ]);
  });

  it("marks Studio manual channel handoff stale when thumbnail assets drift", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioChannelHandoff(runId);
    await writeFile(
      path.join(process.cwd(), "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg"),
      "changed thumbnail template",
      "utf8",
    );

    const detail = await getStudioRunDetail(runId);

    expect(detail?.channelHandoff).toMatchObject({
      kind: "stale",
      message: expect.stringContaining("Thumbnail asset changed"),
    });
    expect(detail?.nextRecommendedCommand).toContain("pnpm producer channel-handoff");
  });

  it("surfaces the recorded manual channel handoff decision in Studio read-only views", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioChannelHandoffDecision(runId);
    const detail = await getStudioRunDetail(runId);

    expect(detail?.channelHandoffDecision).toMatchObject({
      kind: "present",
      decision: {
        decision: "accepted-for-manual-channel-prep",
        reviewedBy: "operator",
        selectedThumbnailCandidate: { candidateId: "thumbnail-01-left" },
      },
      reviewPath: "production/channel_handoff_decision.md",
    });
    expect(detail?.nextRecommendedCommand).toContain("Private upload remains disabled");
    expect(detail?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exists: true,
          label: "Manual channel handoff decision",
          path: "production/channel_handoff_decision.md",
        }),
      ]),
    );
  });

  it("marks stale or malformed manual channel handoff decisions as untrusted in Studio", async () => {
    const staleRunId = await createRenderedStudioRunFixture();
    await writeStudioChannelHandoffDecision(staleRunId);
    const staleHandoffPath = artifactPath(staleRunId, channelHandoffJsonPath);
    const staleHandoff = JSON.parse(await readFile(staleHandoffPath, "utf8")) as {
      operatorChecklist: string[];
    };
    await writeFile(
      staleHandoffPath,
      JSON.stringify({
        ...staleHandoff,
        operatorChecklist: [...staleHandoff.operatorChecklist, "Tampered after decision."],
      }),
      "utf8",
    );

    const staleDetail = await getStudioRunDetail(staleRunId);

    expect(staleDetail?.channelHandoffDecision).toMatchObject({
      kind: "stale",
      message: "Manual channel-handoff decision depends on stale channel handoff evidence.",
    });
    expect(staleDetail?.nextRecommendedCommand).toContain("pnpm producer channel-handoff");

    const invalidRunId = await createRenderedStudioRunFixture();
    await writeStudioChannelHandoff(invalidRunId);
    await writeFile(artifactPath(invalidRunId, channelHandoffDecisionJsonPath), "{", "utf8");

    const invalidDetail = await getStudioRunDetail(invalidRunId);

    expect(invalidDetail?.channelHandoffDecision).toMatchObject({
      kind: "invalid",
    });
    expect(invalidDetail?.nextRecommendedCommand).toContain("pnpm producer decide channel-handoff");
  });

  it("marks manual channel handoff stale when referenced thumbnail assets drift in Studio", async () => {
    const runId = await createRenderedStudioRunFixture();
    await writeStudioChannelHandoff(runId);
    await writeFile(
      path.join(process.cwd(), "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg"),
      "changed thumbnail template",
      "utf8",
    );

    const detail = await getStudioRunDetail(runId);

    expect(detail?.channelHandoff).toMatchObject({
      kind: "stale",
      message: expect.stringContaining("Thumbnail asset changed"),
    });
    expect(detail?.nextRecommendedCommand).toBe(`pnpm producer channel-handoff --run ${runId}`);
    expectWorkflowSteps(detail?.workflowProgress, [
      ["Final review handoff", "done"],
      ["Manual channel handoff", "blocked"],
    ]);
  });
});

function expectWorkflowSteps(
  steps: readonly StatusWorkflowStep[] | undefined,
  expected: readonly (readonly [label: string, status: StatusWorkflowStep["status"]])[],
): void {
  expect(steps).toBeDefined();
  const actual = steps ?? [];
  const labels = actual.map((step) => step.label);
  const start = labels.indexOf(expected[0]?.[0] ?? "");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(
    actual.slice(start, start + expected.length).map((step) => [step.label, step.status]),
  ).toEqual(expected);
}
