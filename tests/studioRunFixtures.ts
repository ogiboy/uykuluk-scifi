import { mkdir, writeFile } from "node:fs/promises";
import { artifactPath } from "../src/core/artifacts";
import { createRun, loadRun, saveRun } from "../src/core/runStore";
import { studioEvidenceFixture } from "./studioEvidenceFixture";

export { studioEvidenceFixture } from "./studioEvidenceFixture";

/**
 * Creates a rendered studio run fixture and persists its artifacts.
 *
 * @returns The generated run ID.
 */
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
    artifactPath(run.runId, "production/storyboard_contact_sheet.md"),
    [
      "# Storyboard Contact Sheet",
      "",
      "## Scene Asset Map",
      "",
      "Scene 1 uses assets/backgrounds/nebula.png.",
      "",
      "## Intro And Outro Bookends",
      "",
      "Review bookend/source-frame paths before voiceover or render approval.",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    artifactPath(run.runId, "production/asset_provenance.json"),
    JSON.stringify({ assets: [{ path: "assets/backgrounds/nebula.png", role: "background" }] }),
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
      "production/storyboard_contact_sheet.md",
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
      digest: "a".repeat(64),
      bytes: 1024,
      durationSeconds: 8.2,
      mediaProbe: {
        binary: "ffprobe",
        durationSeconds: 8.2,
        audio: { codecName: "aac" },
        video: { height: 720, width: 1280 },
      },
      path: "production/render/draft.mp4",
      sourceFrameCount: 4,
      sourceFrameSegments: ["intro:2", "outro:2"],
      sourceFrameCadence: [
        "intro#1=1s assets/intro/frames/intro_frame_00.jpg",
        "intro#2=1s assets/intro/frames/intro_frame_01.jpg",
        "outro#1=1.5s assets/outro/frames/outro_frame_00.jpg",
        "outro#2=1.5s assets/outro/frames/outro_frame_01.jpg",
      ],
      timelineSegments: ["intro", "scene", "outro"],
      overlayRoles: ["watermark", "popup-card"],
      reviewPath: "production/render/draft_review.md",
      reviewChecklist: ["Review local draft only."],
      ffmpegReviewCommand: "ffmpeg -v error -i production/render/draft.mp4 -f null -",
      renderApproval: { approvalId: "approval_render_fixture", approvedRef: "d".repeat(64) },
      voiceoverMode: "local-piper",
      voiceoverProductionVoiceCandidate: true,
      voiceoverQuality: "local-piper",
    },
    nextRecommendedCommand: "pnpm producer review render --run <run_id>",
    renderPlan: {
      status: "pass",
      path: "production/render_plan.json",
      digest: "b".repeat(64),
      artifactCount: 3,
      assetCount: 11,
    },
    voiceoverAudio: {
      status: "pass",
      path: "production/audio/voiceover.wav",
      digest: "c".repeat(64),
      durationSeconds: 8.2,
      localPlaybackPath: `runs/${run.runId}/production/audio/voiceover.wav`,
      mode: "local-piper",
      productionVoiceCandidate: true,
      quality: "local-piper",
      reviewPath: "production/audio/voiceover_review.md",
      sourceWordCount: 42,
    },
  });
  await writeReadiness(run.runId, true, [
    {
      name: "draft render available",
      status: "pass",
      message:
        "production/render/draft.mp4 exists with 8s ffprobe-validated draft video (1280x720, audio stream present, voiceover local-piper production voice candidate, approval approval_render_fixture).",
    },
    {
      name: "public upload disabled without explicit config",
      status: "pass",
      message: "Public/scheduled publish remains disabled by default.",
    },
  ]);
  return run.runId;
}

/**
 * Writes the evidence bundle for a run.
 *
 * @param runId - The run identifier
 * @param evidence - Additional evidence fields to include in the bundle
 */
export async function writeEvidence(
  runId: string,
  evidence: Record<string, unknown>,
): Promise<void> {
  const run = await loadRun(runId);
  await writeFile(
    artifactPath(runId, "evidence_bundle.json"),
    JSON.stringify(studioEvidenceFixture(run.runId, run.state, evidence, run.artifacts)),
    "utf8",
  );
}

export type StudioReadinessFixtureCheck = {
  message: string;
  name: string;
  nextAction?: string;
  status: "block" | "pass" | "warn";
};

/**
 * Writes a studio readiness report for a run.
 *
 * @param runId - The run identifier
 * @param passed - Whether the readiness check passed
 * @param checks - The readiness checks to include in the report
 */
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
