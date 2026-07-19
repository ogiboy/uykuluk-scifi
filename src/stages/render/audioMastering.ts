import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";
import { digestSchema } from "./renderPlanSchemas.js";

export const audioMasteringEvidencePath = "production/render/audio_mastering.json";

export const voiceForwardMasteringProfile = {
  id: "voice-forward-v1",
  integratedLufs: -14,
  toleranceLufs: 1,
  normalizationTruePeakDbtp: -1.5,
  maxOutputTruePeakDbtp: -1,
  loudnessRangeLufs: 11,
} as const;

export const loudnormMeasurementSchema = z.strictObject({
  integratedLufs: z.number().finite(),
  truePeakDbtp: z.number().finite(),
  loudnessRangeLufs: z.number().finite().nonnegative(),
  thresholdLufs: z.number().finite(),
  targetOffsetLufs: z.number().finite(),
});

export type LoudnormMeasurement = z.infer<typeof loudnormMeasurementSchema>;

export const audioMasteringEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  algorithm: z.literal("ffmpeg-loudnorm-two-pass-v1"),
  createdAt: z.iso.datetime(),
  source: z.strictObject({ soundtrackManifestDigest: digestSchema, voiceoverDigest: digestSchema }),
  target: z.strictObject({
    profileId: z.literal(voiceForwardMasteringProfile.id),
    integratedLufs: z.literal(voiceForwardMasteringProfile.integratedLufs),
    toleranceLufs: z.literal(voiceForwardMasteringProfile.toleranceLufs),
    normalizationTruePeakDbtp: z.literal(voiceForwardMasteringProfile.normalizationTruePeakDbtp),
    maxOutputTruePeakDbtp: z.literal(voiceForwardMasteringProfile.maxOutputTruePeakDbtp),
    loudnessRangeLufs: z.literal(voiceForwardMasteringProfile.loudnessRangeLufs),
  }),
  firstPass: loudnormMeasurementSchema,
  outputMeasurement: loudnormMeasurementSchema,
  passed: z.literal(true),
});

export type AudioMasteringEvidence = z.infer<typeof audioMasteringEvidenceSchema>;

/** Builds the deterministic first-pass EBU R128 analysis filter. */
export function firstPassLoudnormFilter(): string {
  const profile = voiceForwardMasteringProfile;
  return `loudnorm=I=${profile.integratedLufs}:TP=${profile.normalizationTruePeakDbtp}:LRA=${profile.loudnessRangeLufs}:print_format=json`;
}

/** Builds the measured second-pass loudness-normalization filter. */
export function secondPassLoudnormFilter(measurement: LoudnormMeasurement): string {
  const measured = loudnormMeasurementSchema.parse(measurement);
  const profile = voiceForwardMasteringProfile;
  return [
    `loudnorm=I=${profile.integratedLufs}`,
    `TP=${profile.normalizationTruePeakDbtp}`,
    `LRA=${profile.loudnessRangeLufs}`,
    `measured_I=${formatFilterNumber(measured.integratedLufs)}`,
    `measured_TP=${formatFilterNumber(measured.truePeakDbtp)}`,
    `measured_LRA=${formatFilterNumber(measured.loudnessRangeLufs)}`,
    `measured_thresh=${formatFilterNumber(measured.thresholdLufs)}`,
    `offset=${formatFilterNumber(measured.targetOffsetLufs)}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
}

/** Parses the final complete loudnorm JSON object from bounded FFmpeg stderr. */
export function parseLoudnormMeasurement(stderr: string): LoudnormMeasurement {
  const candidates = stderr.match(/\{[^{}]*\}/gu) ?? [];
  for (const candidate of [...candidates].reverse()) {
    try {
      const value = JSON.parse(candidate) as Record<string, unknown>;
      if (!("input_i" in value) || !("input_tp" in value)) continue;
      return loudnormMeasurementSchema.parse({
        integratedLufs: numericField(value, "input_i"),
        truePeakDbtp: numericField(value, "input_tp"),
        loudnessRangeLufs: numericField(value, "input_lra"),
        thresholdLufs: numericField(value, "input_thresh"),
        targetOffsetLufs: numericField(value, "target_offset"),
      });
    } catch {
      // Continue until the final complete loudnorm object is found.
    }
  }
  throw new SafeExitError("FFmpeg did not return complete loudnorm JSON measurements.");
}

/** Enforces the publish-quality output loudness and true-peak envelope. */
export function assertMasteringOutput(measurement: LoudnormMeasurement): void {
  const parsed = loudnormMeasurementSchema.parse(measurement);
  const profile = voiceForwardMasteringProfile;
  const minimumLufs = profile.integratedLufs - profile.toleranceLufs;
  const maximumLufs = profile.integratedLufs + profile.toleranceLufs;
  if (parsed.integratedLufs < minimumLufs || parsed.integratedLufs > maximumLufs) {
    throw new SafeExitError(
      `Mastered output integrated loudness ${parsed.integratedLufs} LUFS is outside ${minimumLufs}..${maximumLufs} LUFS.`,
    );
  }
  if (parsed.truePeakDbtp > profile.maxOutputTruePeakDbtp) {
    throw new SafeExitError(
      `Mastered output true peak ${parsed.truePeakDbtp} dBTP exceeds ${profile.maxOutputTruePeakDbtp} dBTP.`,
    );
  }
  if (parsed.loudnessRangeLufs > profile.loudnessRangeLufs) {
    throw new SafeExitError(
      `Mastered output loudness range ${parsed.loudnessRangeLufs} LU exceeds ${profile.loudnessRangeLufs} LU.`,
    );
  }
}

function numericField(value: Record<string, unknown>, key: string): number {
  const parsed = Number(value[key]);
  if (!Number.isFinite(parsed)) {
    throw new SafeExitError(`FFmpeg loudnorm measurement ${key} is missing or non-finite.`);
  }
  return parsed;
}

function formatFilterNumber(value: number): string {
  if (!Number.isFinite(value)) throw new SafeExitError("Loudnorm filter value must be finite.");
  return Number(value.toFixed(6)).toString();
}
