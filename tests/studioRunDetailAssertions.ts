import { expect } from "vitest";
import type { StudioRunDetail } from "../apps/studio/src/lib/runSummaries";

/**
 * Asserts the production media rows for a rendered Studio run detail.
 *
 * @param detail - The Studio run detail under test.
 * @param runId - The run identifier used in materialized operator commands.
 */
export function expectRenderedProductionMedia(detail: StudioRunDetail | null, runId: string): void {
  expect(detail?.productionMedia).toEqual([
    {
      artifactPath: "production/render_plan.json",
      detail: "11 assets, 3 artifacts",
      evidenceKey: "renderPlan",
      facts: ["11 assets", "3 artifacts"],
      label: "Render plan",
      reviewArtifactPath: "production/storyboard_contact_sheet.md",
      reviewCommand: `pnpm producer review render-plan --run ${runId}`,
      status: "pass",
    },
    {
      artifactPath: "production/audio/voiceover.wav",
      detail: "8s, local-piper, production voice candidate, 42 source words",
      evidenceKey: "voiceoverAudio",
      facts: ["8s", "local-piper", "production voice candidate", "42 source words"],
      label: "Voiceover audio",
      localPlaybackPath: `runs/${runId}/production/audio/voiceover.wav`,
      renderApprovalCommand: `pnpm producer approve render --run ${runId}`,
      renderApprovalScope: "production-voice-candidate",
      reviewArtifactPath: "production/audio/voiceover_review.md",
      reviewCommand: `pnpm producer review voice --run ${runId}`,
      status: "pass",
    },
    {
      artifactPath: "production/render/draft.mp4",
      detail:
        "8s, intro -> scene -> outro, source frames intro:2/outro:2, frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg, voiceover local-piper production candidate, approval approval_render_fixture, ffprobe 1280x720 audio",
      evidenceKey: "draftRender",
      facts: [
        "8s",
        "intro -> scene -> outro",
        "source frames intro:2/outro:2",
        "frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg",
        "voiceover local-piper production candidate",
        "approval approval_render_fixture",
        "ffprobe 1280x720 audio",
      ],
      label: "Draft render",
      localPlaybackPath: `runs/${runId}/production/render/draft.mp4`,
      reviewArtifactPath: "production/render/draft_review.md",
      reviewCommand: `pnpm producer review render --run ${runId}`,
      status: "pass",
    },
  ]);
}

/**
 * Asserts the artifact previews for a rendered Studio run detail.
 *
 * @param detail - The Studio run detail under test.
 */
export function expectRenderedArtifactPreviews(detail: StudioRunDetail | null): void {
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
        path: "production/storyboard_contact_sheet.md",
        description: expect.stringContaining("bookend/source-frame"),
        exists: true,
        group: "Render Planning",
        kind: "markdown",
        operatorAction: expect.stringContaining("not render approval"),
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
        operatorAction: expect.stringContaining("producer review voice"),
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
        description: expect.stringMatching(/ffprobe media evidence.*review command/),
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
}
