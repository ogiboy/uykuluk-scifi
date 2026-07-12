import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";
import type { TtsCharacterAlignment } from "./providers/ttsProvider.js";
import { readWavInfo } from "./voiceWav.js";

const characterAlignmentSchema = z
  .strictObject({
    characters: z.array(z.string()),
    characterStartTimesSeconds: z.array(z.number().nonnegative()),
    characterEndTimesSeconds: z.array(z.number().nonnegative()),
  })
  .superRefine((alignment, context) => {
    const lengths = [
      alignment.characters.length,
      alignment.characterStartTimesSeconds.length,
      alignment.characterEndTimesSeconds.length,
    ];
    if (new Set(lengths).size !== 1 || lengths[0] === 0) {
      context.addIssue({
        code: "custom",
        message: "ElevenLabs alignment arrays must be non-empty and have equal lengths.",
      });
    }
  });

export function parseElevenLabsAlignment(
  alignment: TtsCharacterAlignment | undefined,
  durationSeconds: number,
): TtsCharacterAlignment {
  if (!alignment) {
    throw new SafeExitError("ElevenLabs TTS response did not include character alignment.");
  }
  const parsed = characterAlignmentSchema.parse(alignment);
  for (let index = 0; index < parsed.characters.length; index += 1) {
    const start = parsed.characterStartTimesSeconds[index];
    const end = parsed.characterEndTimesSeconds[index];
    if (
      end < start ||
      (index > 0 && start < parsed.characterStartTimesSeconds[index - 1]) ||
      (index > 0 && end < parsed.characterEndTimesSeconds[index - 1])
    ) {
      throw new SafeExitError("ElevenLabs character alignment is not monotonic.");
    }
  }
  if ((parsed.characterEndTimesSeconds.at(-1) ?? 0) > durationSeconds + 0.5) {
    throw new SafeExitError("ElevenLabs character alignment exceeds the returned audio duration.");
  }
  return parsed;
}

export function stitchElevenLabsAlignments(
  alignments: readonly TtsCharacterAlignment[],
  audioChunks: readonly Buffer[],
): TtsCharacterAlignment {
  const stitched: TtsCharacterAlignment = {
    characters: [],
    characterStartTimesSeconds: [],
    characterEndTimesSeconds: [],
  };
  let offsetSeconds = 0;
  for (const [index, alignment] of alignments.entries()) {
    stitched.characters.push(...alignment.characters);
    stitched.characterStartTimesSeconds.push(
      ...alignment.characterStartTimesSeconds.map((value) => value + offsetSeconds),
    );
    stitched.characterEndTimesSeconds.push(
      ...alignment.characterEndTimesSeconds.map((value) => value + offsetSeconds),
    );
    offsetSeconds += readWavInfo(audioChunks[index]).durationSeconds;
  }
  return characterAlignmentSchema.parse(stitched);
}

export function elevenLabsContextText(
  value: string | undefined,
  edge: "start" | "end",
): string | undefined {
  if (!value) return undefined;
  const limit = 1_000;
  return edge === "start" ? value.slice(0, limit) : value.slice(-limit);
}
