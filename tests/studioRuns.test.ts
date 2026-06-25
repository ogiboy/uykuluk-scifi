import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail, listStudioRuns } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";

describe("Studio read-only run summaries", () => {
  useTempProject();

  it("lists persisted runs without mutating run state", async () => {
    const first = await createRun();
    await saveRun({
      ...first,
      state: "READY_FOR_MANUAL_PRODUCTION",
      artifacts: ["evidence_bundle.json", "diagnostics/readiness.json"],
      approvals: [
        {
          approvalId: "approval_test",
          runId: first.runId,
          target: "script",
          approvedRef: "script-digest",
          previousState: "SCRIPT_REVIEWED",
          nextState: "SCRIPT_APPROVED",
          approvingCommand: "producer approve script",
          createdAt: "2026-06-23T00:00:00.000Z",
        },
      ],
      warnings: ["needs fact check"],
    });
    await writeEvidence(first.runId, {
      nextRecommendedCommand: "pnpm producer approve render --run <run_id>",
      blockedActions: ["Public/scheduled publish disabled by default."],
    });
    await writeReadiness(first.runId, true);
    const second = await createRun();

    const summaries = await listStudioRuns();

    expect(summaries.map((run) => run.runId)).toEqual([second.runId, first.runId]);
    expect(summaries[0]).toMatchObject({
      nextRecommendedCommand: "pnpm producer ideas",
      state: "NEW",
    });
    expect(summaries[1]).toMatchObject({
      approvalCount: 1,
      artifactCount: 2,
      nextRecommendedCommand: "pnpm producer approve render --run <run_id>",
      readinessPassed: true,
      state: "READY_FOR_MANUAL_PRODUCTION",
      warningCount: 1,
    });
    expect((await loadRun(first.runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  });

  it("reads run detail with reviewable evidence and artifact flags", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/production/render`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "script.md"),
      "# Bölüm Taslağı\n\nİlk sahne hazır.",
      "utf8",
    );
    await writeFile(
      artifactPath(run.runId, "production/render_plan.json"),
      JSON.stringify({ scenes: [{ id: "scene-1", background: "assets/backgrounds/nebula.png" }] }),
      "utf8",
    );
    await writeFile(
      artifactPath(run.runId, "production/asset_provenance.json"),
      JSON.stringify({
        assets: [{ path: "assets/backgrounds/nebula.png", role: "background" }],
      }),
      "utf8",
    );
    await mkdir(`runs/${run.runId}/production/audio`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "production/audio/voiceover_review.md"),
      "# Voiceover Review\n\nConfirm pacing before render approval.",
      "utf8",
    );
    await writeFile(
      artifactPath(run.runId, "production/render/draft.mp4"),
      Buffer.from([0, 1, 2, 3]),
    );
    await writeFile(
      artifactPath(run.runId, "production/render/draft_review.md"),
      "# Draft Render Review\n\nUpload remains disabled.",
      "utf8",
    );
    await saveRun({
      ...run,
      state: "RENDERED",
      artifacts: [
        "script.md",
        "production/render_plan.json",
        "production/asset_provenance.json",
        "production/audio/voiceover_review.md",
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
        "production/render/draft_review.md",
        "evidence_bundle.json",
        "diagnostics/readiness.json",
      ],
    });
    await writeEvidence(run.runId, {
      currentState: "RENDERED",
      draftRender: { status: "pass", path: "production/render/draft.mp4" },
      nextRecommendedCommand: "Manual final draft review. Upload remains approval-gated.",
    });
    await writeReadiness(run.runId, true);

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      runId: run.runId,
      state: "RENDERED",
      evidence: {
        currentState: "RENDERED",
        nextRecommendedCommand: "Manual final draft review. Upload remains approval-gated.",
      },
      readiness: { passed: true },
    });
    expect(detail?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "script.md",
          exists: true,
          kind: "markdown",
          preview: expect.stringContaining("Bölüm Taslağı"),
          sizeBytes: expect.any(Number),
        }),
        expect.objectContaining({
          path: "production/render_plan.json",
          description: expect.stringContaining("scene-to-asset"),
          exists: true,
          group: "Render Planning",
          kind: "json",
          operatorAction: expect.stringContaining("scene timing"),
          preview: expect.stringContaining('"scenes"'),
        }),
        expect.objectContaining({
          path: "production/asset_provenance.json",
          exists: true,
          group: "Render Planning",
          label: "Asset provenance",
          preview: expect.stringContaining("assets/backgrounds/nebula.png"),
        }),
        expect.objectContaining({
          path: "production/audio/voiceover_review.md",
          exists: true,
          group: "Audio And Render",
          kind: "markdown",
          operatorAction: expect.stringContaining("pacing"),
          preview: expect.stringContaining("Voiceover Review"),
        }),
        expect.objectContaining({
          path: "production/render/draft_review.md",
          exists: true,
          group: "Audio And Render",
          kind: "markdown",
          operatorAction: expect.stringContaining("private upload approval"),
          preview: expect.stringContaining("Upload remains disabled"),
        }),
        expect.objectContaining({
          path: "production/render/draft.mp4",
          exists: true,
          group: "Audio And Render",
          kind: "binary",
          operatorAction: expect.stringContaining("Review locally outside Studio"),
          preview: null,
          sizeBytes: 4,
        }),
        expect.objectContaining({ path: "evidence_bundle.json", exists: true }),
      ]),
    );
    expect((await loadRun(run.runId)).state).toBe("RENDERED");
  });

  it("shows canonical early next actions before evidence exists", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: ["ideas.json"],
      state: "IDEAS_GENERATED",
    });

    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      nextRecommendedCommand: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
      state: "IDEAS_GENERATED",
    });
    expect(detail?.evidence).toBeNull();
    expect((await loadRun(run.runId)).state).toBe("IDEAS_GENERATED");
  });
});

async function writeEvidence(runId: string, evidence: Record<string, unknown>): Promise<void> {
  await writeFile(artifactPath(runId, "evidence_bundle.json"), JSON.stringify(evidence), "utf8");
}

async function writeReadiness(runId: string, passed: boolean): Promise<void> {
  await mkdir(`runs/${runId}/diagnostics`, { recursive: true });
  await writeFile(
    artifactPath(runId, "diagnostics/readiness.json"),
    JSON.stringify({ runId, passed, checks: [] }),
    "utf8",
  );
}
