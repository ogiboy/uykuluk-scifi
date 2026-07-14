import { z } from "zod";

import { digestSchema } from "../../render/renderPlanSchemas.js";
import { voiceoverPreparationPath, voiceoverPreparedTextPath } from "../voiceoverPreparation.js";

export const alignedSubtitlePath = "production/audio/subtitles.aligned.srt";
export const alignedSubtitleMetadataPath = "production/audio/subtitles.aligned.meta.json";

export const voiceSubtitleTimingModeSchema = z.enum([
  "linear-fallback",
  "elevenlabs-character-aligned",
]);
export type VoiceSubtitleTimingMode = z.infer<typeof voiceSubtitleTimingModeSchema>;

export const voiceSubtitleThresholds = {
  maxCharactersPerLine: 46,
  maxLinesPerCue: 2,
  maxCharactersPerSecond: 24,
  minCueDurationSeconds: 0.8,
  maxCueDurationSeconds: 7,
} as const;

const thresholdsSchema = z.strictObject({
  maxCharactersPerLine: z.literal(46),
  maxLinesPerCue: z.literal(2),
  maxCharactersPerSecond: z.literal(24),
  minCueDurationSeconds: z.literal(0.8),
  maxCueDurationSeconds: z.literal(7),
});

const artifactDigestSchema = z.strictObject({ path: z.string().min(1), sha256: digestSchema });
const subtitleOutputPathSchema = z.enum([alignedSubtitlePath, "production/subtitles.srt"]);

export const voiceSubtitleMetadataSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    runId: z.string().min(1),
    createdAt: z.iso.datetime(),
    algorithm: z.strictObject({
      id: z.literal("uykuluk-voice-subtitles"),
      version: z.literal("1.0.0"),
    }),
    timingMode: voiceSubtitleTimingModeSchema,
    thresholds: thresholdsSchema,
    source: z.strictObject({
      path: z.literal("production/voiceover.txt"),
      sha256: digestSchema,
      normalizedSha256: digestSchema,
      normalizedCharacterCount: z.int().positive(),
    }),
    prepared: z.strictObject({
      path: z.literal(voiceoverPreparedTextPath),
      sha256: digestSchema,
      characterCount: z.int().positive(),
    }),
    preparation: z.strictObject({
      path: z.literal(voiceoverPreparationPath),
      sha256: digestSchema,
      schemaVersion: z.literal(2),
    }),
    audio: z.strictObject({
      path: z.literal("production/audio/voiceover.wav"),
      sha256: digestSchema,
      durationSeconds: z.number().positive(),
    }),
    alignment: z
      .strictObject({
        authority: z.literal("elevenlabs-original"),
        path: z.literal("production/audio/alignment.json"),
        sha256: digestSchema,
        characterCount: z.int().positive(),
      })
      .optional(),
    normalizedAlignment: artifactDigestSchema
      .extend({ characterCount: z.int().positive() })
      .optional(),
    output: z.strictObject({
      path: subtitleOutputPathSchema,
      sha256: digestSchema,
      cueCount: z.int().positive(),
      firstCueStartSeconds: z.number().nonnegative(),
      lastCueEndSeconds: z.number().positive(),
    }),
  })
  .superRefine((metadata, context) => {
    if (metadata.timingMode === "elevenlabs-character-aligned") {
      if (metadata.output.lastCueEndSeconds > metadata.audio.durationSeconds + 0.001) {
        context.addIssue({
          code: "custom",
          path: ["output", "lastCueEndSeconds"],
          message: "Aligned subtitle cues must remain within the voiceover audio duration.",
        });
      }
      if (!metadata.alignment || metadata.output.path !== alignedSubtitlePath) {
        context.addIssue({
          code: "custom",
          path: ["alignment"],
          message: "Character-aligned subtitles require original ElevenLabs alignment evidence.",
        });
      }
      return;
    }
    if (metadata.alignment || metadata.output.path !== "production/subtitles.srt") {
      context.addIssue({
        code: "custom",
        path: ["timingMode"],
        message: "Linear fallback subtitles must use the production-package SRT.",
      });
    }
  });

export type VoiceSubtitleMetadata = z.infer<typeof voiceSubtitleMetadataSchema>;

export const activeVoiceSubtitleDescriptorSchema = z.strictObject({
  timingMode: voiceSubtitleTimingModeSchema,
  path: subtitleOutputPathSchema,
  sha256: digestSchema,
  metadataPath: z.enum([alignedSubtitleMetadataPath, "production/production_package.meta.json"]),
  metadataSha256: digestSchema,
  cueCount: z.int().positive(),
  sourceDurationSeconds: z.number().positive(),
});

export type ActiveVoiceSubtitleDescriptor = z.infer<typeof activeVoiceSubtitleDescriptorSchema>;

export type VoiceSubtitleBuildResult = {
  subtitleText: string;
  metadata: VoiceSubtitleMetadata;
  metadataText: string;
  descriptor: ActiveVoiceSubtitleDescriptor;
};

export type VoiceSubtitleSrtStats = {
  cueCount: number;
  firstCueStartSeconds: number;
  lastCueEndSeconds: number;
};
