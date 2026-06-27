import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getStudioRunDetail, listStudioRuns } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";
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
    const runId = await createRenderedStudioRunFixture();

    const detail = await getStudioRunDetail(runId);

    expect(detail).toMatchObject({
      runId,
      state: "RENDERED",
      evidence: {
        currentState: "RENDERED",
        nextRecommendedCommand: "Manual final draft review. Upload remains approval-gated.",
      },
      readiness: { passed: true },
    });
    expect((detail as { readinessChecks?: unknown })?.readinessChecks).toEqual([
      {
        message:
          "production/render/draft.mp4 exists with 8s ffprobe-validated draft video (1280x720, audio stream present).",
        name: "draft render available",
        status: "pass",
      },
      {
        message: "Public/scheduled publish remains disabled by default.",
        name: "public upload disabled without explicit config",
        status: "pass",
      },
    ]);
    expect(detail?.productionMedia).toEqual([
      {
        artifactPath: "production/render_plan.json",
        detail: "11 assets, 3 artifacts",
        evidenceKey: "renderPlan",
        label: "Render plan",
        status: "pass",
      },
      {
        artifactPath: "production/audio/voiceover.wav",
        detail: "8s, local-piper, 42 source words",
        evidenceKey: "voiceoverAudio",
        label: "Voiceover audio",
        status: "pass",
      },
      {
        artifactPath: "production/render/draft.mp4",
        detail:
          "8s, intro -> scene -> outro, source frames intro:2/outro:2, ffprobe 1280x720 audio",
        evidenceKey: "draftRender",
        label: "Draft render",
        status: "pass",
      },
    ]);
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
          path: "production/audio/voiceover.wav",
          description: expect.stringContaining("Local TTS WAV"),
          exists: true,
          group: "Audio And Render",
          kind: "binary",
          operatorAction: expect.stringContaining("Listen locally outside Studio"),
          preview: null,
          sizeBytes: 2,
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
          path: "production/render/render_manifest.json",
          description: expect.stringContaining("ffprobe media evidence"),
          group: "Audio And Render",
          kind: "json",
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
    expect((await loadRun(runId)).state).toBe("RENDERED");
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
      nextRecommendedCommand: "pnpm producer script --run <run_id>",
      state: "IDEA_APPROVED",
    });
    expect(detail?.evidence).toBeNull();
    expect((await loadRun(run.runId)).state).toBe("IDEA_APPROVED");
  });
});
