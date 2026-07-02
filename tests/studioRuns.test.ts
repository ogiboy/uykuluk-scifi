import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail, listStudioRuns } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";
import {
  expectRenderedArtifactPreviews,
  expectRenderedProductionMedia,
} from "./studioRunDetailAssertions";
import { createRenderedStudioRunFixture, writeEvidence, writeReadiness } from "./studioRunFixtures";

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
      nextRecommendedCommand: "pnpm producer review voice --run <run_id>",
      blockedActions: [
        "Render plan not generated; run pnpm producer render-plan --run <run_id> before TTS/render work.",
        "Public/scheduled publish disabled by default.",
      ],
    });
    await writeReadiness(first.runId, true);
    const second = await createRun();

    const summaries = await listStudioRuns();

    expect(summaries.map((run) => run.runId)).toEqual([second.runId, first.runId]);
    expect(summaries[0]).toMatchObject({
      nextRecommendedCommand: `pnpm producer evidence --run ${second.runId}`,
      state: "NEW",
    });
    expect(summaries[1]).toMatchObject({
      approvalCount: 1,
      artifactCount: 2,
      blockedActionCount: 2,
      blockedActions: [
        `Render plan not generated; run pnpm producer render-plan --run ${first.runId} before TTS/render work.`,
        "Public/scheduled publish disabled by default.",
      ],
      nextRecommendedCommand: `pnpm producer review voice --run ${first.runId}`,
      readinessPassed: true,
      state: "READY_FOR_MANUAL_PRODUCTION",
      warningCount: 1,
    });
    expect((await loadRun(first.runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
  });

  it("reads run detail with reviewable evidence and artifact flags", async () => {
    const runId = await createRenderedStudioRunFixture();
    const detail = await getStudioRunDetail(runId);
    expect(detail).toMatchObject({
      runId,
      state: "RENDERED",
      evidence: {
        currentState: "RENDERED",
        nextRecommendedCommand: "pnpm producer review render --run <run_id>",
      },
      nextRecommendedCommand: `pnpm producer review render --run ${runId}`,
      readiness: { passed: true },
    });
    expect((detail as { readinessChecks?: unknown })?.readinessChecks).toEqual([
      {
        message:
          "production/render/draft.mp4 exists with 8s ffprobe-validated draft video (1280x720, audio stream present, voiceover local-piper production voice candidate, approval approval_render_fixture).",
        name: "draft render available",
        status: "pass",
      },
      {
        message: "Public/scheduled publish remains disabled by default.",
        name: "public upload disabled without explicit config",
        status: "pass",
      },
    ]);
    expectRenderedProductionMedia(detail, runId);
    expectRenderedArtifactPreviews(detail);
    expect((await loadRun(runId)).state).toBe("RENDERED");
  });

  it("shows readiness remediation commands from CLI diagnostics", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      state: "PRODUCTION_PACKAGE_GENERATED",
      artifacts: ["diagnostics/readiness.json"],
    });
    await writeReadiness(run.runId, false, [
      {
        message: "costs/estimate.json is missing.",
        name: "budget not exceeded",
        nextAction: `pnpm producer estimate --run ${run.runId}`,
        status: "block",
      },
    ]);
    const detail = await getStudioRunDetail(run.runId);
    expect(detail?.readinessChecks).toEqual([
      {
        message: "costs/estimate.json is missing.",
        name: "budget not exceeded",
        nextAction: `pnpm producer estimate --run ${run.runId}`,
        status: "block",
      },
    ]);
  });

  it("projects generated ideas for guarded Studio idea approval", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["ideas.json"], state: "IDEAS_GENERATED" });
    await writeFile(
      artifactPath(run.runId, "ideas.json"),
      JSON.stringify({
        ideas: [
          {
            estimatedDifficulty: "medium",
            fit: "Kanalın bilimsel dikkat ve sinematik anlatım çizgisine uyar.",
            id: "idea_001",
            premise: "Bir uyku laboratuvarı uzak bir gezegenden rüya sinyalleri yakalar.",
            riskLevel: "low",
            style: "sinematik anlatım",
            targetDuration: "8-10 dakika",
            title: "Rüya Sinyali",
          },
        ],
      }),
      "utf8",
    );

    const detail = await getStudioRunDetail(run.runId);

    expect(detail?.generatedIdeas).toEqual([
      {
        estimatedDifficulty: "medium",
        fit: "Kanalın bilimsel dikkat ve sinematik anlatım çizgisine uyar.",
        id: "idea_001",
        premise: "Bir uyku laboratuvarı uzak bir gezegenden rüya sinyalleri yakalar.",
        riskLevel: "low",
        style: "sinematik anlatım",
        targetDuration: "8-10 dakika",
        title: "Rüya Sinyali",
      },
    ]);
  });

  it("shows canonical early next actions before evidence exists", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/script_generation_failure.json"),
      JSON.stringify({
        runId: run.runId,
        stage: "script",
        state: "IDEA_APPROVED",
        providerMode: "ollama",
        model: "qwen3:8b",
        thinkingMode: "no_think",
        message:
          "Invalid script continuation chunk 1 provider response: continuation has no complete sentence.",
        createdAt: "2026-06-25T00:00:00.000Z",
      }),
      "utf8",
    );
    await saveRun({
      ...run,
      approvedIdeaId: "idea_001",
      artifacts: ["ideas.json", "diagnostics/script_generation_failure.json"],
      state: "IDEA_APPROVED",
    });
    const detail = await getStudioRunDetail(run.runId);

    expect(detail).toMatchObject({
      diagnostics: [
        {
          message:
            "Invalid script continuation chunk 1 provider response: continuation has no complete sentence.",
          path: "diagnostics/script_generation_failure.json",
          stage: "script",
        },
      ],
      nextRecommendedCommand: `pnpm producer evidence --run ${run.runId}`,
      state: "IDEA_APPROVED",
    });
    expect(detail?.evidence).toBeNull();
    expect((await loadRun(run.runId)).state).toBe("IDEA_APPROVED");
  });
});
