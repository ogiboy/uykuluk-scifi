import { describe, expect, it } from "vitest";
import {
  buildDraftRenderTimeline,
  buildFfmpegArgs,
  clampRenderDuration,
  draftRenderTargetDuration,
  summarizeDraftRenderTimeline,
} from "../src/stages/render/renderFfmpegPlan";
import { createTwoSceneRenderPlan, linearSubtitleTiming } from "./renderFfmpegPlanFixtures";

const fallbackSubtitlePath = "production/subtitles.srt";

describe("draft render FFmpeg subtitles and duration", () => {
  it("renders popup copy as plain wrapped text instead of leaking Markdown or escaped newlines", () => {
    const renderPlan = createTwoSceneRenderPlan({ overlays: true });
    const firstScene = renderPlan.scenes[0];
    if (!firstScene) {
      throw new Error("Expected first render-plan scene.");
    }
    firstScene.popupCardText =
      "**Organik ≠ Biyolojik:** Karbon içeren yapı tek başına kanıt değildir.";

    const renderedArgs = buildFfmpegArgs({
      durationSeconds: 10,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: fallbackSubtitlePath,
      subtitleTiming: linearSubtitleTiming(5),
    }).join("\n");

    expect(renderedArgs).not.toContain("**Organik");
    expect(renderedArgs).toContain(String.raw`Organik ≠ Biyolojik\:`);
    expect(renderedArgs).toContain("Biyolojik\\:\nKarbon");
    expect(renderedArgs).not.toContain(String.raw`\nKarbon`);
  });

  it("burns character-aligned subtitles without linear setpts scaling", () => {
    const renderPlan = createTwoSceneRenderPlan();
    const timeline = buildDraftRenderTimeline(renderPlan, 10);

    const renderedArgs = buildFfmpegArgs({
      durationSeconds: 10,
      ffmpegOutputPath: "draft.mp4",
      renderPlan,
      runId: "run_test",
      subtitleArtifactPath: "production/audio/subtitles.aligned.srt",
      subtitleTiming: {
        timingMode: "elevenlabs-character-aligned",
        sourceDurationSeconds: 4.9,
        sceneDurationSeconds: 5,
        timeScale: 1,
      },
      timeline,
    }).join("\n");

    expect(renderedArgs).toContain("production/audio/subtitles.aligned.srt");
    expect(renderedArgs).toContain("trim=start=2:end=7,setpts=PTS-STARTPTS,subtitles=");
    expect(renderedArgs).not.toContain("setpts=(PTS-STARTPTS)*");
    expect(renderedArgs).not.toContain("setpts=(PTS-STARTPTS)/");
  });

  it("extends the last scene when no bookends are present and scenes are shorter than target", () => {
    const renderPlan = createTwoSceneRenderPlan({ bookends: false, overlays: false });
    const timeline = buildDraftRenderTimeline(renderPlan, 10);

    expect(timeline.map((item) => item.segment)).toEqual(["scene", "scene"]);
    expect(timeline.map((item) => item.durationSeconds)).toEqual([3, 7]);
    expect(timeline.at(-1)).toMatchObject({
      sceneIndex: 2,
      backgroundAsset: { path: "assets/backgrounds/plate_b.jpg" },
    });
  });

  it("scales intro and outro bookends down for short local review drafts", () => {
    const renderPlan = createTwoSceneRenderPlan();
    const timeline = buildDraftRenderTimeline(renderPlan, 2.1);

    expect(timeline.map((item) => item.segment)).toEqual(["intro", "scene", "outro"]);
    expect(timeline.map((item) => item.durationSeconds)).toEqual([0.8, 0.1, 1.2]);
  });

  it("skips bookends when the draft is too short to retain scene review time", () => {
    const renderPlan = createTwoSceneRenderPlan();
    const timeline = buildDraftRenderTimeline(renderPlan, 0.2);

    expect(timeline).toEqual([
      expect.objectContaining({
        segment: "scene",
        durationSeconds: 0.2,
        backgroundAsset: expect.objectContaining({
          path: "assets/backgrounds/plate_a.jpg",
          role: "background-plate",
        }),
      }),
    ]);
  });

  it("clamps render duration with and without an explicit maximum", () => {
    expect(clampRenderDuration(0.01)).toBe(0.1);
    expect(clampRenderDuration(5)).toBe(5);
    expect(clampRenderDuration(5, 2)).toBe(2);
  });

  it("keeps bookends outside the voiceover window unless the complete draft is capped", () => {
    const renderPlan = createTwoSceneRenderPlan();
    const fullDuration = draftRenderTargetDuration(renderPlan, 10);
    const fullTimeline = buildDraftRenderTimeline(renderPlan, fullDuration);

    expect(fullDuration).toBe(15);
    expect(summarizeDraftRenderTimeline(fullTimeline)).toEqual({
      introDurationSeconds: 2,
      sceneAudioDurationSeconds: 10,
      outroDurationSeconds: 3,
      totalDurationSeconds: 15,
    });

    const cappedDuration = draftRenderTargetDuration(renderPlan, 10, 8);
    expect(cappedDuration).toBe(8);
    expect(
      summarizeDraftRenderTimeline(buildDraftRenderTimeline(renderPlan, cappedDuration)),
    ).toEqual({
      introDurationSeconds: 2,
      sceneAudioDurationSeconds: 3,
      outroDurationSeconds: 3,
      totalDurationSeconds: 8,
    });
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
        subtitleArtifactPath: fallbackSubtitlePath,
        subtitleTiming: linearSubtitleTiming(10),
      }),
    ).toThrow(/at least one/i);
  });
});
