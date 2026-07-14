import { describe, expect, it } from "vitest";

import type { TtsCharacterAlignment } from "../src/stages/voice/providers/ttsProvider";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";
import {
  alignedSubtitleMetadataPath,
  alignedSubtitlePath,
  buildAlignedVoiceSubtitles,
  buildLinearFallbackVoiceSubtitles,
  inspectVoiceSubtitleSrt,
  voiceSubtitleMetadataSchema,
} from "../src/stages/voice/voiceoverSubtitles";
import { sha256 } from "../src/utils/hash";

describe("voiceover subtitles", () => {
  it("uses original alignment timing while displaying original Turkish pronunciation tokens", () => {
    const sourceText = "JWST evreni inceliyor. Bu önemli bir keşif.";
    const preparation = prepareVoiceoverText({
      runId: "run_aligned_subtitles",
      sourceText,
      pronunciationReplacements: { JWST: "James Webb Uzay Teleskobu" },
    });
    const alignment = alignmentFor(preparation.text, 0.07);
    const audioDurationSeconds = finalAlignmentEnd(alignment) + 0.5;

    const result = buildAlignedVoiceSubtitles({
      runId: "run_aligned_subtitles",
      sourceText,
      preparedText: preparation.text,
      preparation: preparation.evidence,
      preparationSha256: sha256(preparation.evidenceText),
      alignment,
      alignmentSha256: sha256(`${JSON.stringify(alignment, null, 2)}\n`),
      audioSha256: "a".repeat(64),
      audioDurationSeconds,
      createdAt: "2026-07-14T10:00:00.000Z",
    });

    expect(result.subtitleText).toContain("JWST evreni inceliyor.");
    expect(result.subtitleText).not.toContain("James Webb Uzay Teleskobu");
    expect(result.descriptor).toMatchObject({
      timingMode: "elevenlabs-character-aligned",
      path: alignedSubtitlePath,
      metadataPath: alignedSubtitleMetadataPath,
      cueCount: 2,
    });
    expect(result.metadata).toMatchObject({
      algorithm: { id: "uykuluk-voice-subtitles", version: "1.0.0" },
      alignment: { authority: "elevenlabs-original" },
      thresholds: { maxCharactersPerLine: 46, maxLinesPerCue: 2 },
    });
    expect(result.metadata.output.lastCueEndSeconds).toBeLessThanOrEqual(audioDurationSeconds);
    expect(voiceSubtitleMetadataSchema.parse(result.metadata)).toEqual(result.metadata);
    expect(sha256(result.metadataText)).toBe(result.descriptor.metadataSha256);
  });

  it("wraps Turkish punctuation within 46 characters and at most two lines", () => {
    const sourceText =
      "Evren genişliyor; fakat neden? Karanlık enerji, ölçümlerde hâlâ büyük bir bilmece olarak duruyor.";
    const preparation = prepareVoiceoverText({
      runId: "run_turkish_wrapping",
      sourceText,
      pronunciationReplacements: {},
    });
    const alignment = alignmentFor(preparation.text, 0.065);

    const result = buildAlignedVoiceSubtitles({
      runId: "run_turkish_wrapping",
      sourceText,
      preparedText: preparation.text,
      preparation: preparation.evidence,
      preparationSha256: sha256(preparation.evidenceText),
      alignment,
      alignmentSha256: "b".repeat(64),
      audioSha256: "c".repeat(64),
      audioDurationSeconds: finalAlignmentEnd(alignment) + 0.5,
    });

    const cueBodies = result.subtitleText
      .trim()
      .split(/\n{2,}/u)
      .map((block) => block.split("\n").slice(2));
    expect(cueBodies.every((lines) => lines.length <= 2)).toBe(true);
    expect(cueBodies.flat().every((line) => Array.from(line).length <= 46)).toBe(true);
    expect(result.subtitleText).toContain("neden?");
  });

  it("splits slowly spoken long cues at word boundaries before the seven-second limit", () => {
    const sourceText =
      "Karanlık enerji ölçümleri evrenin geleceğini anlamak için dikkatle karşılaştırılıyor.";
    const preparation = prepareVoiceoverText({
      runId: "run_slow_turkish_subtitles",
      sourceText,
      pronunciationReplacements: {},
    });
    const alignment = alignmentFor(preparation.text, 0.12);

    const result = buildAlignedVoiceSubtitles({
      runId: "run_slow_turkish_subtitles",
      sourceText,
      preparedText: preparation.text,
      preparation: preparation.evidence,
      preparationSha256: sha256(preparation.evidenceText),
      alignment,
      alignmentSha256: "1".repeat(64),
      audioSha256: "2".repeat(64),
      audioDurationSeconds: finalAlignmentEnd(alignment) + 0.5,
    });

    const cueDurations = result.subtitleText
      .trim()
      .split(/\n{2,}/u)
      .map((block) => block.split("\n")[1] ?? "")
      .map((timing) => timing.split(" --> ").map(parseSrtSeconds))
      .map(([start = 0, end = 0]) => end - start);
    expect(cueDurations.length).toBeGreaterThan(1);
    expect(cueDurations.every((duration) => duration <= 7.001)).toBe(true);
  });

  it("fails closed when original alignment differs from prepared synthesis text", () => {
    const preparation = prepareVoiceoverText({
      runId: "run_alignment_mismatch",
      sourceText: "Merhaba evren.",
      pronunciationReplacements: {},
    });
    const alignment = alignmentFor(`${preparation.text.trimEnd()}!\n`, 0.1);

    expect(() =>
      buildAlignedVoiceSubtitles({
        runId: "run_alignment_mismatch",
        sourceText: "Merhaba evren.",
        preparedText: preparation.text,
        preparation: preparation.evidence,
        preparationSha256: sha256(preparation.evidenceText),
        alignment,
        alignmentSha256: "d".repeat(64),
        audioSha256: "e".repeat(64),
        audioDurationSeconds: finalAlignmentEnd(alignment) + 0.5,
      }),
    ).toThrow(/exactly match prepared synthesis text/i);
  });

  it("records the package SRT as an explicit local linear fallback", () => {
    const sourceText = "Yerel ses için zamanlama taslağı.";
    const preparation = prepareVoiceoverText({
      runId: "run_linear_subtitles",
      sourceText,
      pronunciationReplacements: {},
    });
    const subtitleText = "1\n00:00:00,000 --> 00:00:02,500\nYerel ses için zamanlama taslağı.\n";

    const result = buildLinearFallbackVoiceSubtitles({
      runId: "run_linear_subtitles",
      sourceText,
      preparedText: preparation.text,
      preparation: preparation.evidence,
      preparationSha256: sha256(preparation.evidenceText),
      subtitleText,
      audioSha256: "f".repeat(64),
      audioDurationSeconds: 2,
    });

    expect(result.subtitleText).toBe(subtitleText);
    expect(result.descriptor).toMatchObject({
      timingMode: "linear-fallback",
      path: "production/subtitles.srt",
      sha256: sha256(subtitleText),
      sourceDurationSeconds: 2.5,
    });
    expect(result.metadata.alignment).toBeUndefined();
    expect(result.metadata.audio.durationSeconds).toBe(2);
  });

  it("rejects persisted cues that exceed the readable character rate", () => {
    const subtitleText =
      "1\n00:00:00,000 --> 00:00:01,000\nBu metin bir saniyede kesin okunamaz.\n";

    expect(() => inspectVoiceSubtitleSrt(subtitleText)).toThrow(/timing is not readable/i);
  });
});

function alignmentFor(text: string, secondsPerCharacter: number): TtsCharacterAlignment {
  const characters = Array.from(text);
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, index) => index * secondsPerCharacter),
    characterEndTimesSeconds: characters.map((_, index) => (index + 1) * secondsPerCharacter),
  };
}

function finalAlignmentEnd(alignment: TtsCharacterAlignment): number {
  return alignment.characterEndTimesSeconds.at(-1) ?? 0;
}

function parseSrtSeconds(value: string): number {
  const [hours = 0, minutes = 0, seconds = 0, milliseconds = 0] = value.split(/[:,]/u).map(Number);
  return hours * 3_600 + minutes * 60 + seconds + milliseconds / 1_000;
}
