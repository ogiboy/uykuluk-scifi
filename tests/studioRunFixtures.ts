import { mkdir, writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";

export async function createRenderedStudioRunFixture(): Promise<string> {
  const run = await createRun();
  await mkdir(`runs/${run.runId}/production/render`, { recursive: true });
  await mkdir(`runs/${run.runId}/production/audio`, { recursive: true });
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
  await writeFile(
    artifactPath(run.runId, "production/audio/voiceover_review.md"),
    "# Voiceover Review\n\nConfirm pacing before render approval.",
    "utf8",
  );
  await writeFile(artifactPath(run.runId, "production/audio/voiceover.wav"), Buffer.from([4, 5]));
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
      "production/audio/voiceover.wav",
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
    draftRender: {
      status: "pass",
      durationSeconds: 8.2,
      mediaProbe: {
        audio: { codecName: "aac" },
        video: { height: 720, width: 1280 },
      },
      path: "production/render/draft.mp4",
      sourceFrameCount: 4,
      sourceFrameSegments: ["intro:2", "outro:2"],
      timelineSegments: ["intro", "scene", "outro"],
      voiceoverMode: "local-piper",
      voiceoverProductionVoiceCandidate: true,
    },
    nextRecommendedCommand: "Manual final draft review. Upload remains approval-gated.",
    renderPlan: { status: "pass", artifactCount: 3, assetCount: 11 },
    voiceoverAudio: {
      status: "pass",
      durationSeconds: 8.2,
      mode: "local-piper",
      productionVoiceCandidate: true,
      sourceWordCount: 42,
    },
  });
  await writeReadiness(run.runId, true, [
    {
      name: "draft render available",
      status: "pass",
      message:
        "production/render/draft.mp4 exists with 8s ffprobe-validated draft video (1280x720, audio stream present, voiceover local-piper production voice candidate).",
    },
    {
      name: "public upload disabled without explicit config",
      status: "pass",
      message: "Public/scheduled publish remains disabled by default.",
    },
  ]);
  return run.runId;
}

export async function writeEvidence(
  runId: string,
  evidence: Record<string, unknown>,
): Promise<void> {
  const run = await loadRun(runId);
  await writeFile(
    artifactPath(runId, "evidence_bundle.json"),
    JSON.stringify({ runId, currentState: run.state, ...evidence }),
    "utf8",
  );
}

export type StudioReadinessFixtureCheck = {
  message: string;
  name: string;
  nextAction?: string;
  status: "block" | "pass" | "warn";
};

export async function writeReadiness(
  runId: string,
  passed: boolean,
  checks: readonly StudioReadinessFixtureCheck[] = [],
): Promise<void> {
  const run = await loadRun(runId);
  await mkdir(`runs/${runId}/diagnostics`, { recursive: true });
  await writeFile(
    artifactPath(runId, "diagnostics/readiness.json"),
    JSON.stringify({ runId, currentState: run.state, passed, checks }),
    "utf8",
  );
}
