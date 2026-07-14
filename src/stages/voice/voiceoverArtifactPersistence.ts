import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  artifactPath,
  recordRunArtifact,
  writeRunBinary,
  writeRunJson,
  writeRunText,
} from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { saveRun } from "../../core/runStore.js";
import type { RunRecord } from "../../core/state.js";
import { nowIso } from "../../utils/time.js";
import {
  voiceoverAlignmentPath,
  voiceoverAudioMetaPath,
  voiceoverAudioMetaSchema,
  voiceoverAudioPath,
  voiceoverAudioReviewPath,
  voiceoverNormalizedAlignmentPath,
  type VoiceoverAudioMeta,
} from "./voiceoverEvidence.js";
import {
  prepareVoiceoverText,
  voiceoverPreparationPath,
  voiceoverPreparedTextPath,
} from "./voiceoverPreparation.js";
import { renderVoiceoverReviewMarkdown } from "./voiceoverReviewMarkdown.js";
import {
  alignedSubtitleMetadataPath,
  alignedSubtitlePath,
  buildAlignedVoiceSubtitles,
  buildLinearFallbackVoiceSubtitles,
} from "./voiceoverSubtitles.js";
import { synthesizeVoiceover } from "./voiceSynthesisExecution.js";

type VoiceSource = Readonly<{
  path: "production/voiceover.txt";
  sha256: string;
  wordCount: number;
}>;

/** Persists synthesized voice bytes, timing evidence, subtitle evidence, metadata, and review. */
export async function persistVoiceoverArtifacts(input: {
  run: RunRecord;
  source: VoiceSource;
  sourceText: string;
  mode: VoiceoverAudioMeta["mode"];
  preparation: ReturnType<typeof prepareVoiceoverText>;
  synthesis: Awaited<ReturnType<typeof synthesizeVoiceover>>;
  renderPlanDigest: string;
}): Promise<VoiceoverAudioMeta> {
  let { run } = input;
  const { audio } = input.synthesis;
  run = await writeRunText(run, "voice", voiceoverPreparedTextPath, input.preparation.text);
  run = await writeRunJson(run, "voice", voiceoverPreparationPath, input.preparation.evidence);

  run = audio.outputAlreadyPersisted
    ? await recordRunArtifact(run, "voice", voiceoverAudioPath)
    : await writeRunBinary(run, "voice", voiceoverAudioPath, audio.buffer);

  const alignment = audio.alignment
    ? alignmentDescriptor(voiceoverAlignmentPath, audio.alignment)
    : undefined;
  if (audio.alignment) {
    run = await writeRunJson(run, "voice", voiceoverAlignmentPath, audio.alignment);
  }
  const normalizedAlignment = audio.normalizedAlignment
    ? alignmentDescriptor(voiceoverNormalizedAlignmentPath, audio.normalizedAlignment)
    : undefined;
  if (audio.normalizedAlignment) {
    run = await writeRunJson(
      run,
      "voice",
      voiceoverNormalizedAlignmentPath,
      audio.normalizedAlignment,
    );
  }

  const audioDigest = createHash("sha256").update(audio.buffer).digest("hex");
  const preparationMetadataSha256 = createHash("sha256")
    .update(input.preparation.evidenceText, "utf8")
    .digest("hex");
  const subtitleBuild =
    input.mode === "elevenlabs"
      ? buildAlignedVoiceSubtitles({
          runId: run.runId,
          sourceText: input.sourceText,
          preparedText: input.preparation.text,
          preparation: input.preparation.evidence,
          preparationSha256: preparationMetadataSha256,
          alignment: requireAlignment(audio.alignment),
          alignmentSha256: requireAlignment(alignment).sha256,
          ...(normalizedAlignment ? { normalizedAlignment } : {}),
          audioSha256: audioDigest,
          audioDurationSeconds: audio.durationSeconds,
        })
      : buildLinearFallbackVoiceSubtitles({
          runId: run.runId,
          sourceText: input.sourceText,
          preparedText: input.preparation.text,
          preparation: input.preparation.evidence,
          preparationSha256: preparationMetadataSha256,
          subtitleText: await readFile(artifactPath(run.runId, "production/subtitles.srt"), "utf8"),
          audioSha256: audioDigest,
          audioDurationSeconds: audio.durationSeconds,
        });
  if (subtitleBuild.descriptor.path === alignedSubtitlePath) {
    run = await writeRunText(run, "voice", alignedSubtitlePath, subtitleBuild.subtitleText);
  }
  run = await writeRunJson(run, "voice", alignedSubtitleMetadataPath, subtitleBuild.metadata);

  const meta = voiceoverAudioMetaSchema.parse({
    schemaVersion: 2,
    runId: run.runId,
    createdAt: nowIso(),
    mode: input.mode,
    quality: audio.quality,
    source: {
      ...input.source,
      preparation: {
        path: voiceoverPreparedTextPath,
        sha256: input.preparation.evidence.output.sha256,
        metadataPath: voiceoverPreparationPath,
        metadataSha256: preparationMetadataSha256,
        replacementsApplied: input.preparation.evidence.replacements.length,
      },
    },
    renderPlan: { path: "production/render_plan.json", digest: input.renderPlanDigest },
    output: {
      path: voiceoverAudioPath,
      sha256: audioDigest,
      bytes: audio.buffer.byteLength,
      durationSeconds: audio.durationSeconds,
      sampleRateHz: audio.sampleRateHz,
      channels: audio.channels,
    },
    provider: audio.provider,
    paidExecution: input.synthesis.paidExecution,
    processing: audio.processing,
    alignment,
    normalizedAlignment,
    subtitle: subtitleBuild.descriptor,
  });
  run = await writeRunJson(run, "voice", voiceoverAudioMetaPath, meta);
  run = await writeRunText(
    run,
    "voice",
    voiceoverAudioReviewPath,
    renderVoiceoverReviewMarkdown(meta),
  );
  await saveRun(run);
  return meta;
}

function alignmentDescriptor(
  path: typeof voiceoverAlignmentPath | typeof voiceoverNormalizedAlignmentPath,
  alignment: { characters: readonly string[] },
) {
  return {
    path,
    sha256: createHash("sha256")
      .update(`${JSON.stringify(alignment, null, 2)}\n`, "utf8")
      .digest("hex"),
    characterCount: alignment.characters.length,
  };
}

function requireAlignment<T>(alignment: T | undefined): T {
  if (!alignment) {
    throw new SafeExitError("ElevenLabs voice synthesis requires original alignment evidence.");
  }
  return alignment;
}
