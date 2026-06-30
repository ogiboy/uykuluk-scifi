import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperatorDeskViewModel, formatOperatorDeskPlain } from "../src/cli/operatorDeskModel";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";
import { passingRenderedEvidence } from "./statusOutputEvidenceFixtures";
import { studioEvidenceFixture } from "./studioRunFixtures";

describe("operator desk command and diagnostic summaries", () => {
  useTempProject();

  it("surfaces media review commands in operator desk output", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: [
        "production/render_plan.json",
        "production/audio/voiceover.wav",
        "production/render/draft.mp4",
        "evidence_bundle.json",
      ],
      state: "RENDERED",
    });
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(passingRenderedEvidence(run.runId)),
      "utf8",
    );

    const output = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId: run.runId }));

    expect(output).toContain(
      `- Render plan: pass (11 assets, 3 artifacts) | Review command: pnpm producer review render-plan --run ${run.runId}`,
    );
    expect(output).toContain(
      `- Voiceover audio: pass (8s, local-piper, production voice candidate, 42 source words) | Local playback path: runs/${run.runId}/production/audio/voiceover.wav | Review command: pnpm producer review voice --run ${run.runId}`,
    );
    expect(output).toContain(
      `- Draft render: pass (8s, intro -> scene -> outro, source frames intro:2/outro:2, frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg, voiceover local-piper production candidate, approval approval_render_status, ffprobe 1280x720 audio) | Review command: pnpm producer review render --run ${run.runId}`,
    );
    expect(output).toContain(`- Next safe action: pnpm producer review render --run ${run.runId}`);
    expect(output).toContain(
      `- Review render plan: pnpm producer review render-plan --run ${run.runId}`,
    );
    expect(output).toContain(
      `- Review voiceover audio: pnpm producer review voice --run ${run.runId}`,
    );
  });

  it("surfaces copyable render approval commands when voiceover evidence is ready", async () => {
    const run = await createRun();
    await saveRun({
      ...run,
      artifacts: [
        "production/render_plan.json",
        "production/audio/voiceover.wav",
        "evidence_bundle.json",
        "diagnostics/readiness.json",
      ],
      state: "READY_FOR_MANUAL_PRODUCTION",
    });
    await mkdir(path.dirname(artifactPath(run.runId, "diagnostics/readiness.json")), {
      recursive: true,
    });
    await writeFile(
      artifactPath(run.runId, "diagnostics/readiness.json"),
      JSON.stringify({
        checks: [],
        currentState: "READY_FOR_MANUAL_PRODUCTION",
        passed: true,
        runId: run.runId,
      }),
      "utf8",
    );
    await writeFile(
      artifactPath(run.runId, "evidence_bundle.json"),
      JSON.stringify(
        studioEvidenceFixture(run.runId, "READY_FOR_MANUAL_PRODUCTION", {
          nextRecommendedCommand: "pnpm producer approve render --run <run_id>",
          renderPlan: {
            artifactCount: 3,
            assetCount: 11,
            digest: "a".repeat(64),
            path: "production/render_plan.json",
            status: "pass",
          },
          voiceoverAudio: {
            digest: "b".repeat(64),
            durationSeconds: 8.2,
            localPlaybackPath: `runs/${run.runId}/production/audio/voiceover.wav`,
            mode: "local-piper",
            path: "production/audio/voiceover.wav",
            productionVoiceCandidate: true,
            quality: "local-piper",
            reviewPath: "production/audio/voiceover_review.md",
            sourceWordCount: 42,
            status: "pass",
          },
        }),
      ),
      "utf8",
    );

    const output = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId: run.runId }));

    expect(output).toContain(`- Next safe action: pnpm producer approve render --run ${run.runId}`);
    expect(output).toContain(
      `- Review voiceover audio: pnpm producer review voice --run ${run.runId}`,
    );
    expect(output).toContain(
      `Local playback path: runs/${run.runId}/production/audio/voiceover.wav`,
    );
    expect(output).toContain(`pnpm producer approve render --run ${run.runId}`);
  });

  it("surfaces safe generation diagnostics in operator desk output", async () => {
    const run = await createRun();
    await mkdir(`runs/${run.runId}/diagnostics`, { recursive: true });
    await writeFile(
      artifactPath(run.runId, "diagnostics/ideas_generation_failure.json"),
      JSON.stringify({
        createdAt: "2026-06-25T00:00:00.000Z",
        message:
          "Invalid ideas provider response after repair attempt: ideas.3.fit: repeated framing.",
        model: "qwen3:8b",
        providerMode: "ollama",
        runId: run.runId,
        stage: "ideas",
        state: "NEW",
        thinkingMode: "no_think",
      }),
      "utf8",
    );
    await saveRun({
      ...run,
      artifacts: ["diagnostics/ideas_generation_failure.json"],
      state: "NEW",
    });

    const output = formatOperatorDeskPlain(await buildOperatorDeskViewModel({ runId: run.runId }));

    expect(output).toContain("Diagnostics:");
    expect(output).toContain(
      "- diagnostics/ideas_generation_failure.json [ideas]: Invalid ideas provider response after repair attempt: ideas.3.fit: repeated framing.",
    );
    expect(output).toContain(`- Readiness: pnpm producer readiness --run ${run.runId}`);
  });
});
