import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import type { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import type { VoiceoverAudioMeta } from "./voiceoverEvidence.js";

export const persistedAlignmentSchema = z
  .strictObject({
    characters: z.array(z.string()).min(1),
    characterStartTimesSeconds: z.array(z.number().nonnegative()).min(1),
    characterEndTimesSeconds: z.array(z.number().nonnegative()).min(1),
  })
  .superRefine((alignment, context) => {
    const lengths = [
      alignment.characters.length,
      alignment.characterStartTimesSeconds.length,
      alignment.characterEndTimesSeconds.length,
    ];
    if (new Set(lengths).size !== 1) {
      context.addIssue({ code: "custom", message: "Alignment arrays must have equal lengths." });
    }
  });

/** Validates persisted original and normalized alignment artifacts against voice metadata. */
export async function assertVoiceoverAlignment(
  run: Pick<RunRecord, "artifacts" | "runId">,
  meta: VoiceoverAudioMeta,
  resolveArtifact: (relativePath: string) => string = (relativePath) =>
    artifactPath(run.runId, relativePath),
): Promise<void> {
  if (meta.alignment) {
    await assertAlignmentArtifact(run, meta.alignment, "alignment", resolveArtifact);
  }
  if (meta.schemaVersion === 2 && meta.normalizedAlignment) {
    await assertAlignmentArtifact(
      run,
      meta.normalizedAlignment,
      "normalized alignment",
      resolveArtifact,
    );
  }
}

async function assertAlignmentArtifact(
  run: Pick<RunRecord, "artifacts" | "runId">,
  descriptor: { path: string; sha256: string; characterCount: number },
  label: string,
  resolveArtifact: (relativePath: string) => string,
): Promise<void> {
  if (!run.artifacts.includes(descriptor.path)) {
    throw new SafeExitError(`Voiceover ${label} artifact is not registered: ${descriptor.path}.`);
  }
  const target = resolveArtifact(descriptor.path);
  if (!(await pathExists(target))) {
    throw new SafeExitError(`Voiceover ${label} artifact is missing: ${descriptor.path}.`);
  }
  const text = await readFile(target, "utf8");
  if (createHash("sha256").update(text, "utf8").digest("hex") !== descriptor.sha256) {
    throw new SafeExitError(`Voiceover ${label} digest does not match metadata.`);
  }
  const alignment = persistedAlignmentSchema.parse(JSON.parse(text) as unknown);
  if (alignment.characters.length !== descriptor.characterCount) {
    throw new SafeExitError(`Voiceover ${label} character count does not match metadata.`);
  }
}
