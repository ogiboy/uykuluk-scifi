import { describe, expect, it } from "vitest";
import { buildDraftRenderComposition } from "../src/stages/render/renderComposition";
import { buildDraftRenderTimeline, buildFfmpegArgs } from "../src/stages/render/renderFfmpegPlan";
import { createTwoSceneRenderPlan, linearSubtitleTiming } from "./renderFfmpegPlanFixtures";

const fallbackSubtitlePath = "production/subtitles.srt";

describe("draft render FFmpeg planning", () => {
  it("builds an intro-to-outro FFmpeg plan from all render-plan backgrounds", () => {
    const renderPlan = createTwoSceneRenderPlan();
    const timeline = buildDraftRenderTimeline(renderPlan, 10);

    expect(timeline.map((item) => item.segment)).toEqual(["intro", "scene", "scene", "outro"]);
    expect(timeline.map((item) => item.durationSeconds)).toEqual([2, 3, 2, 3]);
    expect(timeline.map((item) => item.backgroundAsset.path)).toEqual([
      "assets/intro/title_card.jpg",
      "assets/backgrounds/plate_a.jpg",
      "assets/backgrounds/plate_b.jpg",
      "assets/outro/end_screen.jpg",
    ]);

    const args = buildFfmpegArgs({
      durationSeconds: 10,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: fallbackSubtitlePath,
      subtitleTiming: {
        timingMode: "linear-fallback",
        sourceDurationSeconds: 5.5,
        sceneDurationSeconds: 5,
        timeScale: 1.1,
      },
      timeline,
    });
    const renderedArgs = args.join("\n");

    expect(
      buildDraftRenderComposition(renderPlan).overlays.map((overlay) => overlay.asset.role),
    ).toEqual(["lower-third", "waveform-overlay", "popup-card", "watermark"]);
    expect(renderedArgs).toContain("assets/intro/title_card.jpg");
    expect(renderedArgs).toContain("assets/backgrounds/plate_a.jpg");
    expect(renderedArgs).toContain("assets/backgrounds/plate_b.jpg");
    expect(renderedArgs).toContain("assets/outro/end_screen.jpg");
    expect(renderedArgs).toContain("scale=1920:1080");
    expect(renderedArgs).toContain("assets/overlays/lower_third.png");
    expect(renderedArgs).toContain("assets/waveforms/waveform.png");
    expect(renderedArgs).toContain("assets/overlays/popup_card.png");
    expect(renderedArgs).toContain("concat=n=4:v=1:a=0");
    expect(renderedArgs).toContain("force_style='FontSize=22");
    expect(renderedArgs).toContain("MarginV=86");
    expect(args).toContain("[a]");
    expect(renderedArgs).toContain("[4:a]atrim=duration=5,asetpts=PTS-STARTPTS,apad=whole_dur=5");
    expect(renderedArgs).toContain("adelay=2000:all=1");
    expect(renderedArgs).toContain("apad=whole_dur=10,atrim=duration=10[a]");
    expect(renderedArgs).toContain("[subtitleTimeline]split=3");
    expect(renderedArgs).toContain("trim=start=2:end=7,setpts=PTS-STARTPTS");
    expect(renderedArgs).toContain("setpts=(PTS-STARTPTS)*1.1,subtitles=");
    expect(renderedArgs).toContain("setpts=(PTS-STARTPTS)/1.1[subtitleScene]");
    expect(renderedArgs).toContain("[5:v]scale=1280:-1[ov0]");
    expect(renderedArgs).toContain("[8:v]scale=120:-1[ov3]");
    expect(renderedArgs).toContain("overlay=W-w-24:24[overlayOut]");
    expect(renderedArgs).toContain("overlay=0:H-h:enable='between(t\\,2\\,7)'[base1]");
    expect(renderedArgs).toContain(
      "overlay=W-w-48:96:enable='between(t\\,2\\,5)+between(t\\,5\\,7)'",
    );
    expect(renderedArgs).toContain("drawbox=x=iw-404:y=134:w=352:h=156");
    expect(renderedArgs).toContain("drawtext=text='İlk popup kartı\\: ölçüm");
    expect(renderedArgs).toContain("enable='between(t\\,2\\,5)'");
    expect(renderedArgs).toContain("enable='between(t\\,5\\,7)'");
    expect(args).toContain("30");
  });

  it("derives a short no-overlay FFmpeg timeline when one is not supplied", () => {
    const renderPlan = createTwoSceneRenderPlan({ bookends: false, overlays: false });

    const args = buildFfmpegArgs({
      durationSeconds: 2,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: fallbackSubtitlePath,
      subtitleTiming: linearSubtitleTiming(2),
    });
    const renderedArgs = args.join("\n");

    expect(renderedArgs).toContain("assets/backgrounds/plate_a.jpg");
    expect(renderedArgs).not.toContain("assets/backgrounds/plate_b.jpg");
    expect(renderedArgs).toContain("concat=n=1:v=1:a=0");
    expect(renderedArgs).toContain("subtitles=");
    expect(renderedArgs).toContain("drawtext=text='İlk popup kartı\\: ölçüm");
    expect(renderedArgs).not.toContain("[ov0]");
    expect(args).toContain("[a]");
    expect(renderedArgs).toContain("adelay=0:all=1");
    expect(renderedArgs).not.toContain("[subtitleTimeline]split=");
  });

  it("expands intro and outro source frames into FFmpeg inputs when enough review time exists", () => {
    const renderPlan = createTwoSceneRenderPlan({ frames: true, overlays: false });
    const timeline = buildDraftRenderTimeline(renderPlan, 10);

    expect(timeline[0]).toMatchObject({
      segment: "intro",
      sourceFrameAssets: [
        { path: "assets/intro/frames/intro_frame_00.jpg" },
        { path: "assets/intro/frames/intro_frame_01.jpg" },
      ],
    });
    expect(timeline.at(-1)).toMatchObject({
      segment: "outro",
      sourceFrameAssets: [
        { path: "assets/outro/frames/outro_frame_00.jpg" },
        { path: "assets/outro/frames/outro_frame_01.jpg" },
      ],
    });

    const args = buildFfmpegArgs({
      durationSeconds: 10,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: fallbackSubtitlePath,
      subtitleTiming: linearSubtitleTiming(5),
      timeline,
    });
    const renderedArgs = args.join("\n");

    expect(renderedArgs).toContain("assets/intro/frames/intro_frame_00.jpg");
    expect(renderedArgs).toContain("assets/intro/frames/intro_frame_01.jpg");
    expect(renderedArgs).toContain("assets/outro/frames/outro_frame_00.jpg");
    expect(renderedArgs).toContain("assets/outro/frames/outro_frame_01.jpg");
    expect(renderedArgs).toContain("concat=n=6:v=1:a=0");
    expect(args).toContain("[a]");
  });

  it("honors a single source frame instead of falling back to the bookend background", () => {
    const renderPlan = createTwoSceneRenderPlan({ frames: true, overlays: false });
    const timeline = buildDraftRenderTimeline(renderPlan, 10).map((item) =>
      item.segment === "intro"
        ? { ...item, sourceFrameAssets: item.sourceFrameAssets?.slice(0, 1) }
        : item,
    );

    const renderedArgs = buildFfmpegArgs({
      durationSeconds: 10,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: fallbackSubtitlePath,
      subtitleTiming: linearSubtitleTiming(5),
      timeline,
    }).join("\n");

    expect(renderedArgs).toContain("assets/intro/frames/intro_frame_00.jpg");
    expect(renderedArgs).not.toContain("assets/intro/title_card.jpg");
  });

  it("resolves operation-owned hosted scene images beneath the run artifact root", () => {
    const renderPlan = createTwoSceneRenderPlan({ bookends: false, overlays: false });
    renderPlan.scenes[0]!.backgroundAsset.path =
      "operations/image-generation/image_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/scene_001.jpg";

    const renderedArgs = buildFfmpegArgs({
      durationSeconds: 2,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: fallbackSubtitlePath,
      subtitleTiming: linearSubtitleTiming(2),
    }).join("\n");

    expect(renderedArgs).toContain(
      "runs/run_test/operations/image-generation/image_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/scene_001.jpg",
    );
  });
});
