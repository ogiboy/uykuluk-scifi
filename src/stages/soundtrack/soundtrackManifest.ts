import { createHash } from "node:crypto";

import { z } from "zod";
import { loudnormMeasurementSchema } from "../render/audioMastering.js";

export const soundtrackManifestPath = "production/audio/soundtrack/manifest.json";
export const soundtrackReviewPath = "production/audio/soundtrack/review.md";
export const soundtrackArtifactPaths = [soundtrackManifestPath, soundtrackReviewPath] as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const safeIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
const safeText = (maximumLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximumLength)
    .refine((value) => !hasUnsafeControlCharacters(value), "Text contains unsafe controls.");

function hasUnsafeControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code <= 31 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}

const audioContainerSchema = z.enum(["wav", "mp3", "m4a", "ogg", "flac"]);
const audioCodecSchema = z.enum(["pcm_s16le", "pcm_s24le", "mp3", "aac", "vorbis", "flac"]);

export const soundtrackMasteringProfile = {
  targetLufs: -14,
  lufsTolerance: 1,
  maxTruePeakDbtp: -1,
  normalizationCeilingDb: -1.5,
  loudnessRange: 11,
} as const;

const masteringProfileSchema = z.strictObject({
  targetLufs: z.literal(soundtrackMasteringProfile.targetLufs),
  lufsTolerance: z.literal(soundtrackMasteringProfile.lufsTolerance),
  maxTruePeakDbtp: z.literal(soundtrackMasteringProfile.maxTruePeakDbtp),
  normalizationCeilingDb: z.literal(soundtrackMasteringProfile.normalizationCeilingDb),
  loudnessRange: z.literal(soundtrackMasteringProfile.loudnessRange),
});

const voiceoverSchema = z.strictObject({
  path: z.literal("production/audio/voiceover.wav"),
  digest: sha256Schema,
  metadataDigest: sha256Schema,
  durationSeconds: z
    .number()
    .positive()
    .max(60 * 60),
});

const rightsAttestationSchema = z.strictObject({
  basis: z.enum(["owned", "licensed", "public-domain", "permission-granted"]),
  attestedBy: safeText(200),
  attestedAt: z.iso.datetime(),
  evidence: safeText(500),
});

const provenanceSchema = z.strictObject({
  importedBy: safeText(200),
  importedAt: z.iso.datetime(),
  originalFileName: z
    .string()
    .min(1)
    .max(240)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/),
  rights: rightsAttestationSchema,
});

const audioMediaSchema = z.strictObject({
  bytes: z.int().positive().max(2_147_483_647),
  container: audioContainerSchema,
  codec: audioCodecSchema,
  channels: z.union([z.literal(1), z.literal(2)]),
  sampleRateHz: z.union([z.literal(44_100), z.literal(48_000)]),
  durationSeconds: z
    .number()
    .positive()
    .max(60 * 60),
});

export const soundtrackAssetSchema = z
  .strictObject({
    assetId: safeIdentifierSchema,
    role: z.enum(["music", "sfx"]),
    path: z.string(),
    digest: sha256Schema,
    media: audioMediaSchema,
    provenance: provenanceSchema,
  })
  .superRefine((asset, context) => {
    const expectedPath = soundtrackAssetPath(asset.assetId, asset.media.container);
    if (asset.path !== expectedPath) {
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: `Asset path must be ${expectedPath}.`,
      });
    }
  });

const musicSelectionSchema = z.strictObject({
  assetId: safeIdentifierSchema,
  gainDb: z.number().min(-48).max(0),
  trimStartSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
  fadeInSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
  fadeOutSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
});

const sfxCueSchema = z.strictObject({
  cueId: safeIdentifierSchema,
  assetId: safeIdentifierSchema,
  startSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
  gainDb: z.number().min(-48).max(6),
  trimStartSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
  durationSeconds: z
    .number()
    .positive()
    .max(60 * 60),
  fadeInSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
  fadeOutSeconds: z
    .number()
    .nonnegative()
    .max(60 * 60),
});

export const soundtrackDecisionSchema = z.strictObject({
  revision: z.int().positive(),
  status: z.enum(["approved", "rejected"]),
  reviewedBy: safeText(200),
  notes: safeText(4_000),
  decidedAt: z.iso.datetime(),
});

export const soundtrackAnalysisSchema = z.strictObject({
  algorithm: z.literal("ffmpeg-loudnorm-two-pass-v1"),
  measuredAt: z.iso.datetime(),
  normalizationMode: z.literal("linear"),
  firstPass: loudnormMeasurementSchema,
});

const soundtrackManifestObjectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: safeIdentifierSchema,
  revision: z.int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  voiceover: voiceoverSchema,
  mode: z.enum(["voice-only", "mixed"]),
  profile: masteringProfileSchema,
  assets: z.array(soundtrackAssetSchema).max(256),
  music: musicSelectionSchema.optional(),
  sfx: z.array(sfxCueSchema).max(32),
  analysis: soundtrackAnalysisSchema.optional(),
  decision: soundtrackDecisionSchema.optional(),
});

type SoundtrackManifestInput = z.infer<typeof soundtrackManifestObjectSchema>;
type SoundtrackAssetMap = ReadonlyMap<string, SoundtrackManifestInput["assets"][number]>;

export const soundtrackManifestSchema =
  soundtrackManifestObjectSchema.superRefine(refineSoundtrackManifest);

function refineSoundtrackManifest(
  manifest: SoundtrackManifestInput,
  context: z.RefinementCtx<SoundtrackManifestInput>,
): void {
  const assetsById = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  refineUniqueIdentifiers(manifest, assetsById, context);
  refineSoundtrackMode(manifest, context);
  refineMusicSelection(manifest, assetsById, context);
  refineSfxCues(manifest, assetsById, context);
  refineSoundtrackDecision(manifest, context);
}

function refineUniqueIdentifiers(
  manifest: SoundtrackManifestInput,
  assetsById: SoundtrackAssetMap,
  context: z.RefinementCtx<SoundtrackManifestInput>,
): void {
  if (assetsById.size !== manifest.assets.length) {
    context.addIssue({ code: "custom", path: ["assets"], message: "Asset IDs must be unique." });
  }
  const cueIds = manifest.sfx.map((cue) => cue.cueId);
  if (new Set(cueIds).size !== cueIds.length) {
    context.addIssue({ code: "custom", path: ["sfx"], message: "SFX cue IDs must be unique." });
  }
}

function refineSoundtrackMode(
  manifest: SoundtrackManifestInput,
  context: z.RefinementCtx<SoundtrackManifestInput>,
): void {
  if (manifest.mode === "voice-only" && (manifest.music || manifest.sfx.length)) {
    context.addIssue({
      code: "custom",
      path: ["mode"],
      message: "Voice-only mode cannot select music or SFX.",
    });
  }
}

function refineMusicSelection(
  manifest: SoundtrackManifestInput,
  assetsById: SoundtrackAssetMap,
  context: z.RefinementCtx<SoundtrackManifestInput>,
): void {
  if (!manifest.music) return;
  const musicAsset = assetsById.get(manifest.music.assetId);
  if (musicAsset?.role !== "music") {
    context.addIssue({
      code: "custom",
      path: ["music", "assetId"],
      message: "Music selection must reference a music asset.",
    });
    return;
  }
  const remainingDuration = musicAsset.media.durationSeconds - manifest.music.trimStartSeconds;
  if (remainingDuration <= 0) {
    context.addIssue({
      code: "custom",
      path: ["music", "trimStartSeconds"],
      message: "Music trim must start before the selected asset ends.",
    });
  }
  if (
    manifest.music.fadeInSeconds > remainingDuration ||
    manifest.music.fadeOutSeconds > remainingDuration
  ) {
    context.addIssue({
      code: "custom",
      path: ["music"],
      message: "Music fades cannot exceed the remaining selected asset duration.",
    });
  }
}

function refineSfxCues(
  manifest: SoundtrackManifestInput,
  assetsById: SoundtrackAssetMap,
  context: z.RefinementCtx<SoundtrackManifestInput>,
): void {
  for (const [index, cue] of manifest.sfx.entries()) {
    const sfxAsset = assetsById.get(cue.assetId);
    if (sfxAsset?.role !== "sfx") {
      context.addIssue({
        code: "custom",
        path: ["sfx", index, "assetId"],
        message: "SFX cue must reference an SFX asset.",
      });
      continue;
    }
    if (cue.trimStartSeconds + cue.durationSeconds > sfxAsset.media.durationSeconds) {
      context.addIssue({
        code: "custom",
        path: ["sfx", index, "durationSeconds"],
        message: "SFX trim and duration must fit within the selected asset.",
      });
    }
    if (cue.fadeInSeconds > cue.durationSeconds || cue.fadeOutSeconds > cue.durationSeconds) {
      context.addIssue({
        code: "custom",
        path: ["sfx", index],
        message: "SFX fades cannot exceed cue duration.",
      });
    }
  }
}

function refineSoundtrackDecision(
  manifest: SoundtrackManifestInput,
  context: z.RefinementCtx<SoundtrackManifestInput>,
): void {
  if (manifest.decision && manifest.decision.revision !== manifest.revision) {
    context.addIssue({
      code: "custom",
      path: ["decision", "revision"],
      message: "Soundtrack decision must target the current revision.",
    });
  }
  if (manifest.decision?.status === "approved" && !manifest.analysis) {
    context.addIssue({
      code: "custom",
      path: ["decision", "status"],
      message: "Approved soundtrack decisions require current loudness analysis.",
    });
  }
}

export type SoundtrackManifest = z.infer<typeof soundtrackManifestSchema>;
export type SoundtrackAsset = z.infer<typeof soundtrackAssetSchema>;
export type SoundtrackDecision = z.infer<typeof soundtrackDecisionSchema>;
export type SoundtrackAssetBytesReader = (path: string) => Promise<Uint8Array> | Uint8Array;

/** Renders the operator-readable review summary for one exact soundtrack revision. */
export function renderSoundtrackReview(manifest: SoundtrackManifest): string {
  const analysisStatus = manifest.analysis
    ? `pass-one recorded at ${manifest.analysis.measuredAt}`
    : "pending";
  const decisionStatus = manifest.decision
    ? `${manifest.decision.status} for revision ${manifest.decision.revision}`
    : "pending";
  return [
    "# Soundtrack review",
    "",
    `- Revision: ${manifest.revision}`,
    `- Mode: ${manifest.mode}`,
    `- Voiceover digest: ${manifest.voiceover.digest}`,
    `- Imported assets: ${manifest.assets.length}`,
    `- Analysis: ${analysisStatus}`,
    `- Decision: ${decisionStatus}`,
  ].join("\n");
}

/** Builds the only permitted per-run soundtrack asset location. */
export function soundtrackAssetPath(
  assetId: string,
  container: SoundtrackAsset["media"]["container"],
): string {
  return `production/audio/soundtrack/assets/${safeIdentifierSchema.parse(assetId)}.${container}`;
}

/** Computes the lowercase SHA-256 digest retained for imported audio bytes. */
export function soundtrackAssetDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Parses a canonical manifest and verifies that it belongs to the expected run. */
export function validateSoundtrackManifestForRun(
  value: unknown,
  runId: string,
): SoundtrackManifest {
  const manifest = soundtrackManifestSchema.parse(value);
  if (manifest.runId !== safeIdentifierSchema.parse(runId)) {
    throw new Error(
      `Soundtrack manifest run ${manifest.runId} does not match expected run ${runId}.`,
    );
  }
  assertSoundtrackDecisionTargetsCurrentRevision(manifest);
  return manifest;
}

/** Guards consumers against applying a decision recorded for an older soundtrack revision. */
export function assertSoundtrackDecisionTargetsCurrentRevision(
  manifest: Pick<SoundtrackManifest, "revision" | "decision">,
): void {
  if (manifest.decision && manifest.decision.revision !== manifest.revision) {
    throw new Error("Soundtrack decision must target the current revision.");
  }
}

/** Verifies imported asset bytes through the caller-owned read boundary. */
export async function verifySoundtrackAssetDigests(
  manifest: SoundtrackManifest,
  readBytes: SoundtrackAssetBytesReader,
): Promise<void> {
  for (const asset of manifest.assets) {
    const bytes = await readBytes(asset.path);
    if (bytes.byteLength !== asset.media.bytes) {
      throw new Error(`Soundtrack asset ${asset.assetId} byte size does not match its manifest.`);
    }
    if (soundtrackAssetDigest(bytes) !== asset.digest) {
      throw new Error(`Soundtrack asset ${asset.assetId} digest does not match its manifest.`);
    }
  }
}

/** Validates manifest semantics and, when supplied, imported audio integrity. */
export async function validateSoundtrackManifest(
  value: unknown,
  input: Readonly<{ runId: string; readBytes?: SoundtrackAssetBytesReader }>,
): Promise<SoundtrackManifest> {
  const manifest = validateSoundtrackManifestForRun(value, input.runId);
  if (input.readBytes) await verifySoundtrackAssetDigests(manifest, input.readBytes);
  return manifest;
}
