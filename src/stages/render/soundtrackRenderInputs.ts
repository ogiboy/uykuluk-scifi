import { SafeExitError } from "../../core/errors.js";
import type { SoundtrackManifest } from "../soundtrack/soundtrackManifest.js";
import type { RenderSoundtrackInputs } from "./renderAudioMix.js";

/** Maps one approved soundtrack manifest to the exact run-owned FFmpeg inputs. */
export function soundtrackRenderInputs(manifest: SoundtrackManifest): RenderSoundtrackInputs {
  const assets = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  const musicAsset = manifest.music ? assets.get(manifest.music.assetId) : undefined;
  if (manifest.music && musicAsset?.role !== "music") {
    throw new SafeExitError("Soundtrack music selection does not resolve to a music asset.");
  }
  return {
    voiceoverPath: manifest.voiceover.path,
    music:
      manifest.music && musicAsset
        ? {
            path: musicAsset.path,
            gainDb: manifest.music.gainDb,
            trimStartSeconds: manifest.music.trimStartSeconds,
            fadeInSeconds: manifest.music.fadeInSeconds,
            fadeOutSeconds: manifest.music.fadeOutSeconds,
          }
        : undefined,
    sfx: manifest.sfx.map((cue) => {
      const asset = assets.get(cue.assetId);
      if (asset?.role !== "sfx") {
        throw new SafeExitError(`Soundtrack cue ${cue.cueId} does not resolve to an SFX asset.`);
      }
      return {
        path: asset.path,
        gainDb: cue.gainDb,
        startSeconds: cue.startSeconds,
        trimStartSeconds: cue.trimStartSeconds,
        durationSeconds: cue.durationSeconds,
        fadeInSeconds: cue.fadeInSeconds,
        fadeOutSeconds: cue.fadeOutSeconds,
      };
    }),
  };
}
