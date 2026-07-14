import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { renderDraft } from "../src/stages/render";
import { renderApprovalRef } from "../src/stages/render/renderApproval";
import type { DraftRenderManifest } from "../src/stages/renderEvidence";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { expectDraftRenderEvidence } from "./renderEvidenceAssertions";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { createFakeFfmpeg, createFakeFfprobe, renderToolRoot } from "./renderTestHelpers";

describe("draft render", () => {
  useTempProject();

  it("records render approval and writes a draft video manifest through FFmpeg", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const approval = await approveRender(runId);
    const approvedRef = approval.approvedRef ?? "";
    expect(approvedRef).toMatch(/^[a-f0-9]{64}$/);
    const ffmpeg = await createFakeFfmpeg(
      renderToolRoot("manifest with spaces"),
      "fake ffmpeg.mjs",
    );
    const ffprobe = await createFakeFfprobe(renderToolRoot("manifest with spaces"));

    await renderDraft(runId, {
      ffmpegBinary: ffmpeg,
      ffprobeBinary: ffprobe,
      maxDurationSeconds: 8,
    });

    const run = await loadRun(runId);
    expect(approval).toMatchObject({ target: "render", nextState: "RENDER_APPROVED" });
    expect(run.state).toBe("RENDERED");
    expect(run.artifacts).toEqual(
      expect.arrayContaining([
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
        "production/render/draft_review.md",
        "production/render/youtube_chapters.json",
        "production/render/youtube_chapters.md",
      ]),
    );
    const manifest = await readJsonFile<DraftRenderManifest>(
      artifactPath(runId, "production/render/render_manifest.json"),
    );
    const draftRenderArtifactPath = artifactPath(runId, "production/render/draft.mp4");
    expect(manifest.schemaVersion).toBe(9);
    expect(manifest.renderApproval).toEqual({ approvalId: approval.approvalId, approvedRef });
    expect(manifest.output).toMatchObject({
      path: "production/render/draft.mp4",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durationSeconds: 8,
    });
    expect(manifest.output.bytes).toBeGreaterThan(0);
    expect(manifest.chapterDraft).toMatchObject({
      jsonPath: "production/render/youtube_chapters.json",
      jsonSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      markdownPath: "production/render/youtube_chapters.md",
      markdownSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(manifest.renderPlan.path).toBe("production/render_plan.json");
    expect(manifest.voiceoverAudio).toMatchObject({
      mode: "deterministic-local",
      path: "production/audio/voiceover.wav",
      metadataDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      productionVoiceCandidate: false,
      quality: "deterministic-local-reference",
    });
    expect(manifest.subtitles).toMatchObject({
      timingMode: "linear-fallback",
      path: "production/subtitles.srt",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      metadataPath: "production/audio/subtitles.aligned.meta.json",
      metadataSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      cueCount: expect.any(Number),
      sourceDurationSeconds: expect.any(Number),
    });
    expect(manifest.renderApproval.approvedRef).toBe(
      renderApprovalRef({
        renderPlanDigest: manifest.renderPlan.digest,
        subtitleDigest: manifest.subtitles.sha256,
        subtitleMetadataDigest: manifest.subtitles.metadataSha256,
        subtitleTimingMode: manifest.subtitles.timingMode,
        voiceMetadataDigest: manifest.voiceoverAudio.metadataDigest,
        voiceoverAudioDigest: manifest.voiceoverAudio.digest,
        voiceoverMode: manifest.voiceoverAudio.mode,
        voiceoverProductionVoiceCandidate: manifest.voiceoverAudio.productionVoiceCandidate,
        voiceoverQuality: manifest.voiceoverAudio.quality,
      }),
    );
    expect(manifest.timeline.map((item) => item.segment)).toEqual(["intro", "scene", "outro"]);
    expect(manifest.timeline[0]).toMatchObject({
      backgroundAsset: { path: "assets/intro/episode_title_card_1920x1080.jpg" },
      durationSeconds: 2,
      sourceFrameAssets: [
        { path: "assets/intro/frames/intro_frame_00.jpg" },
        { path: "assets/intro/frames/intro_frame_01.jpg" },
      ],
    });
    expect(manifest.timeline[1]).toMatchObject({
      backgroundAsset: { path: "assets/backgrounds/plate_test_1920x1080.jpg" },
      durationSeconds: 3,
    });
    expect(manifest.timeline[2]).toMatchObject({
      backgroundAsset: { path: "assets/outro/youtube_end_screen_1920x1080.jpg" },
      durationSeconds: 3,
      sourceFrameAssets: [
        { path: "assets/outro/frames/outro_frame_00.jpg" },
        { path: "assets/outro/frames/outro_frame_01.jpg" },
      ],
    });
    expect(manifest.timing).toEqual({
      introDurationSeconds: 2,
      sceneAudioDurationSeconds: 3,
      outroDurationSeconds: 3,
      totalDurationSeconds: 8,
    });
    expect(manifest.subtitleTiming).toEqual({
      timingMode: manifest.subtitles.timingMode,
      sceneDurationSeconds: 3,
      sourceDurationSeconds: manifest.subtitles.sourceDurationSeconds,
      timeScale: expect.any(Number),
    });
    expect(manifest.ffmpegTimelineInputs).toMatchObject([
      {
        asset: { path: "assets/intro/frames/intro_frame_00.jpg" },
        durationSeconds: 1,
        frameIndex: 1,
        segment: "intro",
        source: "source-frame",
      },
      {
        asset: { path: "assets/intro/frames/intro_frame_01.jpg" },
        durationSeconds: 1,
        frameIndex: 2,
        segment: "intro",
        source: "source-frame",
      },
      {
        asset: { path: "assets/backgrounds/plate_test_1920x1080.jpg" },
        durationSeconds: 3,
        segment: "scene",
        source: "background",
      },
      {
        asset: { path: "assets/outro/frames/outro_frame_00.jpg" },
        durationSeconds: 1.5,
        frameIndex: 1,
        segment: "outro",
        source: "source-frame",
      },
      {
        asset: { path: "assets/outro/frames/outro_frame_01.jpg" },
        durationSeconds: 1.5,
        frameIndex: 2,
        segment: "outro",
        source: "source-frame",
      },
    ]);
    expect(manifest.ffmpeg.binary).toBe(ffmpeg);
    expect(manifest.mediaProbe).toEqual({
      audio: { channels: 2, codecName: "aac", sampleRateHz: 48000 },
      binary: ffprobe,
      durationSeconds: 8,
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      video: { codecName: "h264", height: 720, width: 1280 },
    });
    expect(manifest.ffmpeg.args.join("\n")).toContain("production/audio/voiceover.wav");
    expect(manifest.ffmpeg.args.join("\n")).toContain("production/subtitles.srt");
    expect(manifest.ffmpeg.args.join("\n")).toContain("adelay=2000:all=1");
    expect(manifest.ffmpeg.args.join("\n")).toContain("[subtitleTimeline]split=3");
    expect(manifest.ffmpeg.args.join("\n")).toContain("[subtitleSceneSource]trim=start=2:end=5");
    expect(manifest.ffmpeg.args.join("\n")).toContain("overlay=0:H-h:enable='between(t\\,2\\,5)'");
    expect(manifest.ffmpeg.args).toContain("[a]");
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/backgrounds/plate_test_1920x1080.jpg",
    );
    expect(manifest.ffmpeg.args.join("\n")).toContain("assets/intro/frames/intro_frame_00.jpg");
    expect(manifest.ffmpeg.args.join("\n")).toContain("assets/intro/frames/intro_frame_01.jpg");
    expect(manifest.ffmpeg.args.join("\n")).toContain("assets/outro/frames/outro_frame_00.jpg");
    expect(manifest.ffmpeg.args.join("\n")).toContain("assets/outro/frames/outro_frame_01.jpg");
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/overlays/popup_info_card_900x520.png",
    );
    expect(manifest.ffmpeg.args.join("\n")).toContain(
      "assets/waveforms/waveform_overlay_thin_panel_transparent_1920x240.png",
    );
    expect(manifest.ffmpeg.args.at(-1)).toContain(".draft.");
    expect(manifest.ffmpeg.reviewArgs).toEqual([
      "-v",
      "error",
      "-i",
      draftRenderArtifactPath,
      "-f",
      "null",
      "-",
    ]);
    expect(manifest.ffmpeg.reviewCommand).toContain(draftRenderArtifactPath);
    expect(manifest.ffmpeg.reviewCommand).toContain(`'${ffmpeg}'`);
    expect(manifest.ffmpeg.reviewCommand).not.toContain(".draft.");
    expect(manifest.composition.overlays.map((overlay) => overlay.role)).toEqual(
      expect.arrayContaining(["watermark", "popup-card", "waveform-overlay"]),
    );
    expect(manifest.composition.reviewChecklist.join(" ")).toContain("private upload");

    await expectDraftRenderEvidence({ approval, approvedRef, draftRenderArtifactPath, runId });
  });
});
