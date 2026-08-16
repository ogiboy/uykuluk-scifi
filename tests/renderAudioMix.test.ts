import { describe, expect, it } from "vitest";
import { buildRenderAudioGraph } from "../src/stages/render/renderAudioMix.js";

const timing = {
  introDurationSeconds: 2,
  sceneAudioDurationSeconds: 6,
  outroDurationSeconds: 2,
  totalDurationSeconds: 10,
};

describe("render audio mix", () => {
  it("builds an explicit mastered voice-only graph", () => {
    const graph = buildRenderAudioGraph({
      firstAudioInputIndex: 4,
      masteringFilter: "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
      runId: "run_audio_mix",
      soundtrack: { voiceoverPath: "production/audio/voiceover.wav", sfx: [] },
      timing,
    });

    expect(graph.inputCount).toBe(1);
    expect(graph.inputArgs).toEqual([
      "-i",
      expect.stringContaining("runs/run_audio_mix/production/audio/voiceover.wav"),
    ]);
    expect(graph.filter).toContain("[4:a]atrim=duration=6");
    expect(graph.filter).toContain("adelay=2000:all=1");
    expect(graph.filter).toContain("[voiceMix]anull[mixedAudio]");
    expect(graph.filter).toContain("loudnorm=I=-14");
  });

  it("mixes one looped music bed and bounded sound-effect cues", () => {
    const graph = buildRenderAudioGraph({
      firstAudioInputIndex: 2,
      masteringFilter: "loudnorm=I=-14",
      runId: "run_audio_mix",
      soundtrack: {
        voiceoverPath: "production/audio/voiceover.wav",
        music: {
          path: "production/audio/soundtrack/imports/music/source.mp3",
          gainDb: -18,
          trimStartSeconds: 1,
          fadeInSeconds: 2,
          fadeOutSeconds: 3,
        },
        sfx: [
          {
            path: "production/audio/soundtrack/imports/sfx/source.wav",
            gainDb: -8,
            startSeconds: 4,
            trimStartSeconds: 0.5,
            durationSeconds: 2,
            fadeInSeconds: 0.1,
            fadeOutSeconds: 0.2,
          },
        ],
      },
      timing,
    });

    expect(graph.inputCount).toBe(3);
    expect(graph.inputArgs.join(" ")).toContain("-stream_loop -1");
    expect(graph.filter).toContain("volume=-18dB");
    expect(graph.filter).toContain("adelay=4000:all=1");
    expect(graph.filter).toContain("amix=inputs=3");
  });

  it("rejects cues that extend beyond the exact render duration", () => {
    expect(() =>
      buildRenderAudioGraph({
        firstAudioInputIndex: 1,
        masteringFilter: "loudnorm=I=-14",
        runId: "run_audio_mix",
        soundtrack: {
          voiceoverPath: "production/audio/voiceover.wav",
          sfx: [
            {
              path: "production/audio/soundtrack/imports/sfx/source.wav",
              gainDb: -8,
              startSeconds: 9,
              trimStartSeconds: 0,
              durationSeconds: 2,
              fadeInSeconds: 0,
              fadeOutSeconds: 0,
            },
          ],
        },
        timing,
      }),
    ).toThrow(/exceeds the render duration/i);
  });
});
