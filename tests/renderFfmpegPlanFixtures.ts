import { buildDraftRenderTimeline } from "../src/stages/render/renderFfmpegPlan";

/**
 * Creates a two-scene render plan fixture.
 *
 * @param options - Controls whether bookends, frame assets, and overlay assets are included.
 * @returns A render plan configured with two scenes and deterministic metadata.
 */
export function createTwoSceneRenderPlan(
  options: { bookends?: boolean; frames?: boolean; overlays?: boolean } = {},
): Parameters<typeof buildDraftRenderTimeline>[0] {
  const digest = "a".repeat(64);
  const overlayAssets =
    options.overlays === false
      ? []
      : [
          { role: "lower-third", path: "assets/overlays/lower_third.png", digest },
          { role: "waveform-overlay", path: "assets/waveforms/waveform.png", digest },
          { role: "popup-card", path: "assets/overlays/popup_card.png", digest },
          { role: "watermark", path: "assets/brand/watermark.png", digest },
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
    bookends: bookends(options, digest),
    scenes: [
      {
        sceneIndex: 1,
        narrationPreview: "Birinci sahne",
        durationSeconds: 3,
        visualPrompt: "A",
        popupCardText: "İlk popup kartı: ölçüm notu",
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
        popupCardText: "İkinci popup kartı",
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

/**
 * Builds the optional intro and outro bookend configuration.
 *
 * @param options - Controls whether bookends are included and whether frame assets are attached.
 * @param digest - The digest applied to the bookend assets.
 * @returns The bookend configuration, or `undefined` when bookends are disabled.
 */
function bookends(
  options: { bookends?: boolean; frames?: boolean },
  digest: string,
): ReturnType<typeof createTwoSceneRenderPlan>["bookends"] {
  if (options.bookends === false) {
    return undefined;
  }
  return {
    intro: {
      durationSeconds: 2,
      asset: { role: "intro-source", path: "assets/intro/title_card.jpg", digest },
      ...(options.frames ? { frameAssets: sourceFrames("intro", digest) } : {}),
    },
    outro: {
      durationSeconds: 3,
      asset: { role: "outro-source", path: "assets/outro/end_screen.jpg", digest },
      ...(options.frames ? { frameAssets: sourceFrames("outro", digest) } : {}),
    },
  };
}

/**
 * Builds frame asset descriptors for a bookend source.
 *
 * @param kind - The bookend type to build frames for.
 * @param digest - The digest to assign to each frame asset.
 * @returns The frame asset descriptors for the requested bookend source.
 */
function sourceFrames(kind: "intro" | "outro", digest: string) {
  return [
    { role: `${kind}-source-frame`, path: `assets/${kind}/frames/${kind}_frame_00.jpg`, digest },
    { role: `${kind}-source-frame`, path: `assets/${kind}/frames/${kind}_frame_01.jpg`, digest },
  ];
}
