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
    await saveRun({
      ...run,
      state: "RENDERED",
      artifacts: [
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
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
        expect.objectContaining({ path: "production/render/draft.mp4", exists: false }),
        expect.objectContaining({ path: "evidence_bundle.json", exists: true }),
      ]),
    );
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
