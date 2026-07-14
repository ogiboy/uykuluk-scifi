import { sha256 } from "../../../utils/hash.js";
import { nowIso } from "../../../utils/time.js";
import type { TtsCharacterAlignment } from "../providers/ttsProvider.js";
import {
  voiceoverPreparationPath,
  voiceoverPreparedTextPath,
  type VoiceoverPreparationV2,
} from "../voiceoverPreparation.js";
import { validateSubtitleAlignment } from "./voiceSubtitleAlignment.js";
import {
  activeVoiceSubtitleDescriptorSchema,
  alignedSubtitleMetadataPath,
  alignedSubtitlePath,
  voiceSubtitleMetadataSchema,
  voiceSubtitleThresholds,
  type VoiceSubtitleBuildResult,
  type VoiceSubtitleMetadata,
  type VoiceSubtitleTimingMode,
} from "./voiceSubtitleContracts.js";
import { buildCueCandidates } from "./voiceSubtitleCues.js";
import { validateSubtitlePreparation } from "./voiceSubtitlePreparation.js";
import { parseAndValidateSrt, renderSrt } from "./voiceSubtitleSrt.js";
import { timeCueCandidates } from "./voiceSubtitleTiming.js";
import type { SubtitleCue } from "./voiceSubtitleTypes.js";

/** Builds Turkish display subtitles from authoritative original ElevenLabs alignment. */
export function buildAlignedVoiceSubtitles(input: {
  runId: string;
  sourceText: string;
  preparedText: string;
  preparation: VoiceoverPreparationV2;
  preparationSha256: string;
  alignment: TtsCharacterAlignment;
  alignmentSha256: string;
  normalizedAlignment?: { path: string; sha256: string; characterCount: number };
  audioSha256: string;
  audioDurationSeconds: number;
  createdAt?: string;
}): VoiceSubtitleBuildResult {
  const source = validateSubtitlePreparation(input);
  const alignment = validateSubtitleAlignment(
    input.alignment,
    input.preparedText,
    input.audioDurationSeconds,
  );
  const candidates = buildCueCandidates(source, input.preparation);
  const cues = timeCueCandidates(
    candidates,
    source,
    input.preparedText,
    input.preparation,
    alignment,
    input.audioDurationSeconds,
  );
  return finalizeBuild({
    runId: input.runId,
    createdAt: input.createdAt,
    timingMode: "elevenlabs-character-aligned",
    source,
    sourceSha256: input.preparation.source.sha256,
    preparedText: input.preparedText,
    preparationSha256: input.preparationSha256,
    audioSha256: input.audioSha256,
    audioDurationSeconds: input.audioDurationSeconds,
    cues,
    outputPath: alignedSubtitlePath,
    alignment: {
      authority: "elevenlabs-original",
      path: "production/audio/alignment.json",
      sha256: input.alignmentSha256,
      characterCount: alignment.characters.length,
    },
    normalizedAlignment: input.normalizedAlignment,
  });
}

/** Records the package SRT as the explicit timing fallback for local voice modes. */
export function buildLinearFallbackVoiceSubtitles(input: {
  runId: string;
  sourceText: string;
  preparedText: string;
  preparation: VoiceoverPreparationV2;
  preparationSha256: string;
  subtitleText: string;
  audioSha256: string;
  audioDurationSeconds: number;
  createdAt?: string;
}): VoiceSubtitleBuildResult {
  const source = validateSubtitlePreparation(input);
  const cues = parseAndValidateSrt(input.subtitleText, false);
  return finalizeBuild({
    runId: input.runId,
    createdAt: input.createdAt,
    timingMode: "linear-fallback",
    source,
    sourceSha256: input.preparation.source.sha256,
    preparedText: input.preparedText,
    preparationSha256: input.preparationSha256,
    audioSha256: input.audioSha256,
    audioDurationSeconds: input.audioDurationSeconds,
    cues,
    outputPath: "production/subtitles.srt",
    subtitleText: input.subtitleText,
  });
}

function finalizeBuild(input: {
  runId: string;
  createdAt?: string;
  timingMode: VoiceSubtitleTimingMode;
  source: string;
  sourceSha256: string;
  preparedText: string;
  preparationSha256: string;
  audioSha256: string;
  audioDurationSeconds: number;
  cues: SubtitleCue[];
  outputPath: VoiceSubtitleMetadata["output"]["path"];
  subtitleText?: string;
  alignment?: NonNullable<VoiceSubtitleMetadata["alignment"]>;
  normalizedAlignment?: VoiceSubtitleMetadata["normalizedAlignment"];
}): VoiceSubtitleBuildResult {
  const subtitleText = input.subtitleText ?? renderSrt(input.cues);
  const metadata = voiceSubtitleMetadataSchema.parse({
    schemaVersion: 1,
    runId: input.runId,
    createdAt: input.createdAt ?? nowIso(),
    algorithm: { id: "uykuluk-voice-subtitles", version: "1.0.0" },
    timingMode: input.timingMode,
    thresholds: voiceSubtitleThresholds,
    source: {
      path: "production/voiceover.txt",
      sha256: input.sourceSha256,
      normalizedSha256: sha256(input.source),
      normalizedCharacterCount: input.source.length,
    },
    prepared: {
      path: voiceoverPreparedTextPath,
      sha256: sha256(input.preparedText),
      characterCount: input.preparedText.length,
    },
    preparation: {
      path: voiceoverPreparationPath,
      sha256: input.preparationSha256,
      schemaVersion: 2,
    },
    audio: {
      path: "production/audio/voiceover.wav",
      sha256: input.audioSha256,
      durationSeconds: input.audioDurationSeconds,
    },
    ...(input.alignment ? { alignment: input.alignment } : {}),
    ...(input.normalizedAlignment ? { normalizedAlignment: input.normalizedAlignment } : {}),
    output: {
      path: input.outputPath,
      sha256: sha256(subtitleText),
      cueCount: input.cues.length,
      firstCueStartSeconds: input.cues[0]?.startSeconds,
      lastCueEndSeconds: input.cues.at(-1)?.endSeconds,
    },
  });
  const metadataText = `${JSON.stringify(metadata, null, 2)}\n`;
  const descriptor = activeVoiceSubtitleDescriptorSchema.parse({
    timingMode: metadata.timingMode,
    path: metadata.output.path,
    sha256: metadata.output.sha256,
    metadataPath: alignedSubtitleMetadataPath,
    metadataSha256: sha256(metadataText),
    cueCount: metadata.output.cueCount,
    sourceDurationSeconds: metadata.output.lastCueEndSeconds,
  });
  return { subtitleText, metadata, metadataText, descriptor };
}
