import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveRender } from "../src/stages/approveRender";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { renderDraft } from "../src/stages/render";
import type { DraftRenderEvidence, DraftRenderManifest } from "../src/stages/renderEvidence";
import { runReadiness } from "../src/stages/readiness";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import {
  createFailingFakeFfprobe,
  createFakeFfmpeg,
  createFakeFfprobe,
  renderToolRoot,
} from "./renderTestHelpers";

describe("draft render", () => {
  useTempProject();

  it("records render approval and writes a draft video manifest through FFmpeg", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const approval = await approveRender(runId);
    const approvedRef = approval.approvedRef ?? "";
    expect(approvedRef).toMatch(/^[a-f0-9]{64}$/);
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("manifest"));
    const ffprobe = await createFakeFfprobe(renderToolRoot("manifest"));

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
      ]),
    );
    const manifest = await readJsonFile<DraftRenderManifest>(
      artifactPath(runId, "production/render/render_manifest.json"),
    );
    expect(manifest.schemaVersion).toBe(6);
    expect(manifest.renderApproval).toEqual({
      approvalId: approval.approvalId,
      approvedRef,
    });
    expect(manifest.output).toMatchObject({
      path: "production/render/draft.mp4",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durationSeconds: 8,
    });
    expect(manifest.output.bytes).toBeGreaterThan(0);
    expect(manifest.renderPlan.path).toBe("production/render_plan.json");
    expect(manifest.voiceoverAudio).toMatchObject({
      mode: "deterministic-local",
      path: "production/audio/voiceover.wav",
      productionVoiceCandidate: false,
      quality: "deterministic-local-reference",
    });
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
    expect(manifest.ffmpeg.reviewArgs.at(-1)).toBe(
      artifactPath(runId, "production/render/draft.mp4"),
    );
    expect(manifest.ffmpeg.reviewCommand).toContain(
      artifactPath(runId, "production/render/draft.mp4"),
    );
    expect(manifest.ffmpeg.reviewCommand).not.toContain(".draft.");
    expect(manifest.composition.overlays.map((overlay) => overlay.role)).toEqual(
      expect.arrayContaining(["watermark", "popup-card", "waveform-overlay"]),
    );
    expect(manifest.composition.reviewChecklist.join(" ")).toContain("private upload");

    const evidence = (await generateEvidenceBundle(runId)) as {
      draftRender: Extract<DraftRenderEvidence, { status: "pass" }>;
    };
    expect(evidence.draftRender).toMatchObject({
      status: "pass",
      path: "production/render/draft.mp4",
      durationSeconds: 8,
      overlayRoles: expect.arrayContaining(["popup-card", "waveform-overlay"]),
      timelineSegments: ["intro", "scene", "outro"],
      sourceFrameCount: 4,
      sourceFrameSegments: ["intro:2", "outro:2"],
      sourceFrameCadence: [
        "intro#1=1s assets/intro/frames/intro_frame_00.jpg",
        "intro#2=1s assets/intro/frames/intro_frame_01.jpg",
        "outro#1=1.5s assets/outro/frames/outro_frame_00.jpg",
        "outro#2=1.5s assets/outro/frames/outro_frame_01.jpg",
      ],
      reviewPath: "production/render/draft_review.md",
      ffmpegReviewCommand: expect.stringContaining(
        artifactPath(runId, "production/render/draft.mp4"),
      ),
      voiceoverMode: "deterministic-local",
      voiceoverProductionVoiceCandidate: false,
      voiceoverQuality: "deterministic-local-reference",
      renderApproval: {
        approvalId: approval.approvalId,
        approvedRef,
      },
      mediaProbe: {
        audio: { codecName: "aac" },
        video: { height: 720, width: 1280 },
      },
    });
    const evidenceMarkdown = await readFile(artifactPath(runId, "evidence_bundle.md"), "utf8");
    expect(evidenceMarkdown).toContain("## Production Media Summary");
    expect(evidenceMarkdown).toContain("Render plan: pass");
    expect(evidenceMarkdown).toContain("Voiceover audio: pass");
    expect(evidenceMarkdown).toContain(
      `Draft render: pass (8s, intro -> scene -> outro, source frames intro:2/outro:2, frame cadence intro#1=1s assets/intro/frames/intro_frame_00.jpg; intro#2=1s assets/intro/frames/intro_frame_01.jpg; outro#1=1.5s assets/outro/frames/outro_frame_00.jpg; outro#2=1.5s assets/outro/frames/outro_frame_01.jpg, voiceover deterministic-local timing/reference only, approval ${approval.approvalId}, ffprobe 1280x720 audio)`,
    );
    const review = await readFile(artifactPath(runId, "production/render/draft_review.md"), "utf8");
    expect(review).toContain("# Draft Render Review");
    expect(review).toContain("## FFmpeg Review Command");
    expect(review).toContain(artifactPath(runId, "production/render/draft.mp4"));
    expect(review).toContain("atomic temporary output");
    expect(review).toContain("## Media Probe");
    expect(review).toContain("## Render Approval");
    expect(review).toContain("## Source Frame Cadence");
    expect(review).toContain("| intro | - | 1 | 1s | assets/intro/frames/intro_frame_00.jpg |");
    expect(review).toContain("| outro | - | 2 | 1.5s | assets/outro/frames/outro_frame_01.jpg |");
    expect(review).toContain(approval.approvalId);
    expect(review).toContain(approvedRef);
    expect(review).toContain("1280x720 h264");
    expect(review).toContain("Local review artifact only");
    expect(review).toContain("timing/reference only; local timing draft");
    expect(review).toContain("not final production voice");
    expect(review).toContain("assets/intro/episode_title_card_1920x1080.jpg");
    expect(review).toContain("assets/outro/youtube_end_screen_1920x1080.jpg");
    expect(review).toContain("## Operator Decision");
    expect(review).toContain(`Keep the local draft with run ${runId} for manual review`);
    expect(review).toContain("Upload remains disabled");
    expect(review).toContain("Scheduled/public publish remains disabled");

    const readiness = await runReadiness(runId);
    expect(readiness.checks.find((check) => check.name === "draft render available")).toMatchObject(
      {
        message: expect.stringContaining(
          `ffprobe-validated draft video (1280x720, audio stream present, source frames intro:2/outro:2, voiceover deterministic-local timing/reference only, approval ${approval.approvalId})`,
        ),
        status: "pass",
      },
    );
  });

  it("blocks draft render completion when media probing cannot validate the output", async () => {
    const runId = await prepareVoiceoverReadyRun();
    await approveRender(runId);
    const ffmpeg = await createFakeFfmpeg(renderToolRoot("probe-failure"));
    const ffprobe = await createFailingFakeFfprobe(renderToolRoot("probe-failure"));

    await expect(
      renderDraft(runId, { ffmpegBinary: ffmpeg, ffprobeBinary: ffprobe, maxDurationSeconds: 1 }),
    ).rejects.toThrow(/ffprobe exited/i);

    const run = await loadRun(runId);
    expect(run.state).toBe("RENDER_APPROVED");
    expect(run.artifacts).not.toContain("production/render/draft.mp4");
    expect(await pathExists(artifactPath(runId, "production/render/draft.mp4"))).toBe(false);
  });
});
