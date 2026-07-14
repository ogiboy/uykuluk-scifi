import { createHash } from "node:crypto";

import type { ProducerConfig } from "../../../config/schema.js";
import {
  readRegisteredArtifactBytesAtProjectRoot,
  registeredArtifactRevisionAtProjectRoot,
} from "../../../core/artifactRevision.js";
import { SafeExitError } from "../../../core/errors.js";
import type { RunRecord } from "../../../core/state.js";
import { sha256 } from "../../../utils/hash.js";
import {
  isVoiceSelectionArtifactPath,
  voicePreviewAudioArtifactPathSchema,
  voicePreviewEvidenceArtifactPathSchema,
  voicePreviewEvidenceSchema,
  voicePreviewFailureDirectory,
  voicePreviewFailurePath,
  voiceSelectionSchema,
} from "./voiceAuditionContracts.js";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
  voiceCandidatesSchema,
} from "./voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./voiceCatalogDigest.js";
import { assertNestedCatalogDigests } from "./voiceCatalogIntegrity.js";
import { maximumVoiceCatalogAgeMs } from "./voiceCatalogStore.js";
import { assertVoiceSelectionMatchesEvidence } from "./voiceSelectionIntegrity.js";

export type SelectedVoiceAuditionArtifacts = {
  catalog: string;
  previewEvidence: string;
  previewAudio: string;
  selection: string;
};

/** Identifies persisted audition inputs whose byte changes invalidate evidence guidance. */
export function isVoiceAuditionRevisionArtifact(artifact: string): boolean {
  return (
    isVoiceCandidatesArtifactPath(artifact) ||
    isVoiceCatalogFailureArtifactPath(artifact) ||
    isVoiceSelectionArtifactPath(artifact) ||
    voicePreviewEvidenceArtifactPathSchema.safeParse(artifact).success ||
    voicePreviewAudioArtifactPathSchema.safeParse(artifact).success ||
    artifact === voicePreviewFailurePath ||
    artifact.startsWith(`${voicePreviewFailureDirectory}/`) ||
    /^production\/audio\/previews\/[A-Za-z0-9._-]{1,128}\.(json|mp3|wav)$/.test(artifact)
  );
}

/**
 * Hashes the exact registered voice audition inputs for evidence freshness checks.
 *
 * @param run - Run identity and ordered artifact registry.
 * @param projectRoot - Producer project root; defaults to the active CLI/core root.
 * @returns A SHA-256 revision over audition artifact paths and bytes.
 */
export async function voiceAuditionArtifactRevision(
  run: Pick<RunRecord, "runId" | "artifacts">,
  relativePaths: readonly string[],
  projectRoot: string = process.cwd(),
): Promise<string> {
  return registeredArtifactRevisionAtProjectRoot(projectRoot, run, relativePaths);
}

/**
 * Validates and hashes the four artifacts that bind a persisted ElevenLabs selection.
 *
 * The exact byte revision is returned immediately when it differs from the persisted revision so
 * callers can classify ordinary in-place drift as stale. When bytes still match, the catalog,
 * preview, audio, and selection contracts are cross-checked before the snapshot is trusted.
 */
export async function validatedVoiceAuditionArtifactRevision(input: {
  projectRoot: string;
  run: Pick<RunRecord, "runId" | "artifacts">;
  artifacts: SelectedVoiceAuditionArtifacts;
  config: ProducerConfig;
  expectedRevision: string;
  expectedSelectionDigest: string;
  expectedValidUntil: string;
}): Promise<string> {
  const paths = Object.values(input.artifacts);
  const byteEntries = await Promise.all(
    paths.map(async (relativePath) => {
      const bytes = await readRegisteredArtifactBytesAtProjectRoot(
        input.projectRoot,
        input.run,
        relativePath,
      );
      if (!bytes) {
        throw new SafeExitError(`Selected voice evidence is missing: ${relativePath}.`);
      }
      return {
        bytes,
        path: relativePath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
  const revision = sha256(
    JSON.stringify(byteEntries.map(({ path, sha256: digest }) => ({ path, sha256: digest }))),
  );
  if (revision !== input.expectedRevision) {
    return revision;
  }

  const bytesByPath = new Map(byteEntries.map((entry) => [entry.path, entry.bytes]));
  const catalog = voiceCandidatesSchema.parse(parseJson(bytesByPath.get(input.artifacts.catalog)));
  const preview = voicePreviewEvidenceSchema.parse(
    parseJson(bytesByPath.get(input.artifacts.previewEvidence)),
  );
  const selection = voiceSelectionSchema.parse(
    parseJson(bytesByPath.get(input.artifacts.selection)),
  );
  if (catalog.runId !== input.run.runId || preview.runId !== input.run.runId) {
    throw new SafeExitError("Selected voice catalog or preview belongs to a different run.");
  }
  if (selection.runId !== input.run.runId) {
    throw new SafeExitError("Selected voice selection belongs to a different run.");
  }
  const { catalogDigest, ...catalogDigestInput } = catalog;
  const { previewDigest, ...previewDigestInput } = preview;
  const { selectionDigest, ...selectionDigestInput } = selection;
  if (
    canonicalVoiceEvidenceDigest(catalogDigestInput) !== catalogDigest ||
    canonicalVoiceEvidenceDigest(previewDigestInput) !== previewDigest ||
    canonicalVoiceEvidenceDigest(selectionDigestInput) !== selectionDigest
  ) {
    throw new SafeExitError("Selected voice evidence contains an invalid canonical digest.");
  }
  assertNestedCatalogDigests(catalog);
  const audioEntry = byteEntries.find((entry) => entry.path === input.artifacts.previewAudio);
  if (
    preview.output.bytes !== audioEntry?.bytes.byteLength ||
    preview.output.sha256 !== audioEntry?.sha256
  ) {
    throw new SafeExitError("Selected voice preview audio does not match its evidence digest.");
  }
  if (
    selectionDigest !== input.expectedSelectionDigest ||
    preview.output.path !== input.artifacts.previewAudio ||
    input.expectedValidUntil !==
      new Date(Date.parse(catalog.fetchedAt) + maximumVoiceCatalogAgeMs).toISOString()
  ) {
    throw new SafeExitError("Selected voice evidence binding is inconsistent.");
  }
  assertVoiceSelectionMatchesEvidence({
    catalogPath: input.artifacts.catalog,
    previewPath: input.artifacts.previewEvidence,
    catalog,
    preview,
    selection,
    config: input.config,
  });
  return revision;
}

/** Returns the ordered registered audition paths without reading artifact bytes. */
export function voiceAuditionArtifactPaths(artifacts: readonly string[]): string[] {
  return artifacts.filter(isVoiceAuditionRevisionArtifact);
}

/** Hashes only the ordered audition registry for cheap same-state revision discovery. */
export function voiceAuditionPathRevision(artifacts: readonly string[]): string {
  return sha256(JSON.stringify(voiceAuditionArtifactPaths(artifacts)));
}

/** Hashes execution-relevant TTS configuration without reading credentials. */
export function ttsConfigurationDigest(tts: ProducerConfig["providers"]["tts"]): string {
  if (!tts.enabled) {
    return canonicalVoiceEvidenceDigest({ enabled: false });
  }
  if (tts.mode === "local-piper") {
    return canonicalVoiceEvidenceDigest({
      enabled: true,
      mode: tts.mode,
      piperBinary: tts.piperBinary,
      piperModelPath: tts.piperModelPath,
      piperConfigPath: tts.piperConfigPath,
      pronunciationReplacements: tts.pronunciationReplacements,
    });
  }
  if (tts.mode === "deterministic-local") {
    return canonicalVoiceEvidenceDigest({
      enabled: true,
      mode: tts.mode,
      pronunciationReplacements: tts.pronunciationReplacements,
    });
  }
  const elevenLabs = { ...tts.elevenLabs };
  delete elevenLabs.voiceId;
  return canonicalVoiceEvidenceDigest({
    enabled: true,
    mode: tts.mode,
    pronunciationReplacements: tts.pronunciationReplacements,
    elevenLabs,
  });
}

function parseJson(bytes: Buffer | undefined): unknown {
  if (!bytes) {
    throw new SafeExitError("Selected voice evidence is missing.");
  }
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new SafeExitError("Selected voice evidence contains invalid JSON.");
  }
}
