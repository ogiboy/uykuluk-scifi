import { describe, expect, it } from "vitest";
import { buildDraftRenderComposition } from "../src/stages/renderComposition";
import { buildDraftRenderTimeline, buildFfmpegArgs } from "../src/stages/renderFfmpegPlan";

describe("draft render FFmpeg planning", () => {
  it("builds a scene-timed FFmpeg plan from all render-plan backgrounds", () => {
    const renderPlan = createTwoSceneRenderPlan();
    const timeline = buildDraftRenderTimeline(renderPlan, 10);

    expect(timeline.map((item) => item.durationSeconds)).toEqual([3, 7]);
    expect(timeline.map((item) => item.backgroundAsset.path)).toEqual([
      "assets/backgrounds/plate_a.jpg",
      "assets/backgrounds/plate_b.jpg",
    ]);

    const args = buildFfmpegArgs({
      durationSeconds: 10,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      timeline,
    });
    const renderedArgs = args.join("\n");

    expect(
      buildDraftRenderComposition(renderPlan).overlays.map((overlay) => overlay.asset.role),
    ).toEqual(["lower-third", "waveform-overlay", "popup-card", "watermark"]);
    expect(renderedArgs).toContain("assets/backgrounds/plate_a.jpg");
    expect(renderedArgs).toContain("assets/backgrounds/plate_b.jpg");
    expect(renderedArgs).toContain("assets/overlays/lower_third.png");
    expect(renderedArgs).toContain("assets/waveforms/waveform.png");
    expect(renderedArgs).toContain("assets/overlays/popup_card.png");
    expect(renderedArgs).toContain("concat=n=2:v=1:a=0");
    expect(args).toContain("2:a");
    expect(renderedArgs).toContain("[3:v]scale=1280:-1[ov0]");
    expect(renderedArgs).toContain("[6:v]scale=120:-1[ov3]");
    expect(renderedArgs).toContain("overlay=W-w-24:24[v]");
    expect(args).toContain("30");
  });

  it("derives a short no-overlay FFmpeg timeline when one is not supplied", () => {
    const renderPlan = createTwoSceneRenderPlan({ overlays: false });

    const args = buildFfmpegArgs({
      durationSeconds: 2,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
    });
    const renderedArgs = args.join("\n");

    expect(renderedArgs).toContain("assets/backgrounds/plate_a.jpg");
    expect(renderedArgs).not.toContain("assets/backgrounds/plate_b.jpg");
    expect(renderedArgs).toContain("concat=n=1:v=1:a=0");
    expect(renderedArgs).toContain("subtitles=");
    expect(renderedArgs).not.toContain("[ov0]");
    expect(args).toContain("1:a");
  });

  it("rejects a render plan without scenes before building FFmpeg args", () => {
    const emptyPlan = { ...createTwoSceneRenderPlan(), scenes: [] };

    expect(() => buildDraftRenderTimeline(emptyPlan, 10)).toThrow(/at least one/i);
    expect(() =>
      buildFfmpegArgs({
        durationSeconds: 10,
        ffmpegOutputPath: "draft.mp4",
        renderPlan: emptyPlan,
        runId: "run_test",
      }),
    ).toThrow(/at least one/i);
  });
});

function createTwoSceneRenderPlan(
  options: { overlays?: boolean } = {},
): Parameters<typeof buildDraftRenderTimeline>[0] {
  const digest = "a".repeat(64);
  const overlayAssets =
    options.overlays === false
      ? []
      : [
          {
            role: "lower-third",
            path: "assets/overlays/lower_third.png",
            digest,
          },
          {
            role: "waveform-overlay",
            path: "assets/waveforms/waveform.png",
            digest,
          },
          {
            role: "popup-card",
            path: "assets/overlays/popup_card.png",
            digest,
          },
          {
            role: "watermark",
            path: "assets/brand/watermark.png",
            digest,
          },
        ];
  return {
    schemaVersion: 1,
    runId: "run_test",
    createdAt: "2026-06-25T00:00:00.000Z",
    productionPackageManifestPath: "production/production_package.meta.json",
    productionPackageManifestDigest: digest,
    format: {
      resolution: "1920x1080",
      fps: 30,
      aspectRatio: "16:9",
      draftRenderer: "ffmpeg-local-draft",
    },
    scenes: [
      {
        sceneIndex: 1,
        narrationPreview: "Birinci sahne",
        durationSeconds: 3,
        visualPrompt: "A",
        backgroundAsset: {
          role: "background-plate",
          path: "assets/backgrounds/plate_a.jpg",
          digest,
        },
        overlayAssets,
        subtitleSource: "production/subtitles.srt",
        voiceoverSource: "production/voiceover.txt",
      },
      {
        sceneIndex: 2,
        narrationPreview: "İkinci sahne",
        durationSeconds: 4,
        visualPrompt: "B",
        backgroundAsset: {
          role: "background-plate",
          path: "assets/backgrounds/plate_b.jpg",
          digest,
        },
        overlayAssets: [],
        subtitleSource: "production/subtitles.srt",
        voiceoverSource: "production/voiceover.txt",
      },
    ],
  };
}
