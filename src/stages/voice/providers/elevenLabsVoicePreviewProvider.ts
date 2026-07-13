import { SafeExitError } from "../../../core/errors.js";
import { sha256 } from "../../../utils/hash.js";
import { nowIso } from "../../../utils/time.js";
import {
  normalizeVoiceCandidate,
  resolveVoicePreview,
} from "../catalog/voiceCandidateNormalization.js";
import type {
  ElevenLabsCatalogClient,
  VoicePreviewProvider,
  VoicePreviewProviderResult,
} from "../catalog/voiceCatalogProvider.js";
import { createOfficialElevenLabsCatalogClient } from "./elevenLabsCatalogClient.js";
import { downloadElevenLabsPreview } from "./elevenLabsPreviewDownload.js";

const previewMetadataTimeoutMs = 30_000;

type Options = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ElevenLabsCatalogClient;
  fetcher?: typeof fetch;
};

/** Refetches an exact persisted candidate and downloads one bounded audition preview. */
export class ElevenLabsVoicePreviewProvider implements VoicePreviewProvider {
  readonly provider = "elevenlabs" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => ElevenLabsCatalogClient;
  private readonly fetcher: typeof fetch;

  constructor(options: Options = {}) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialElevenLabsCatalogClient;
    this.fetcher = options.fetcher ?? fetch;
  }

  assertReady(): void {
    if (!this.readApiKey()?.trim()) {
      throw new SafeExitError(
        "ElevenLabs voice preview requires ELEVENLABS_API_KEY in the server environment.",
      );
    }
  }

  async fetchPreview(
    input: Parameters<VoicePreviewProvider["fetchPreview"]>[0],
  ): Promise<VoicePreviewProviderResult> {
    this.assertReady();
    const apiKey = this.readApiKey()?.trim();
    if (!apiKey) throw new SafeExitError("ElevenLabs voice preview credential is unavailable.");
    try {
      const response = await this.createClient(apiKey).getVoice(input.candidate.voiceId, {
        abortSignal: AbortSignal.timeout(previewMetadataTimeoutMs),
      });
      const normalized = normalizeVoiceCandidate(
        response.data,
        { languageCode: input.languageCode, modelId: input.modelId },
        input.subscription,
      );
      if (!normalized || normalized.metadataDigest !== input.candidate.metadataDigest) {
        throw new SafeExitError("ElevenLabs voice metadata changed after catalog generation.");
      }
      const preview = resolveVoicePreview(response.data, {
        languageCode: input.languageCode,
        modelId: input.modelId,
      });
      if (
        !preview.url ||
        (preview.sourceClass !== "elevenlabs" && preview.sourceClass !== "eleven-public-prod") ||
        sha256(preview.url) !== input.candidate.preview.urlSha256
      ) {
        throw new SafeExitError("ElevenLabs preview metadata changed after catalog generation.");
      }
      const downloaded = await downloadElevenLabsPreview(
        preview.url,
        preview.sourceClass,
        this.fetcher,
      );
      return {
        audio: downloaded.audio,
        format: downloaded.format,
        fetchedAt: nowIso(),
        requestIdHashes: [response.requestId, downloaded.requestId]
          .filter((value): value is string => Boolean(value))
          .map((value) => sha256(value)),
        sourceClass: preview.sourceClass,
        sourceUrlSha256: sha256(preview.url),
        voiceMetadataDigest: normalized.metadataDigest,
      };
    } catch (error) {
      if (error instanceof SafeExitError) throw error;
      throw new SafeExitError("ElevenLabs voice preview request failed safely.");
    }
  }
}
