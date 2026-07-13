import { writeFile } from "node:fs/promises";
import { defaultConfig } from "../src/config/config";
import type { ProducerConfig } from "../src/config/schema";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import type { VoiceCandidates } from "../src/stages/voice/catalog/voiceCatalogContracts";
import { normalizeVoiceCatalog } from "../src/stages/voice/catalog/voiceCatalogNormalization";
import type {
  CatalogModel,
  CatalogSubscription,
  CatalogVoice,
  VoiceCatalogProvider,
  VoicePreviewProvider,
} from "../src/stages/voice/catalog/voiceCatalogProvider";
import type { VoiceExecutionMetadataProvider } from "../src/stages/voice/voiceExecutionPreflight";
import { sha256 } from "../src/utils/hash";
import { playableMp3Bytes } from "./voicePreviewTestAudio";

/**
 * Configures ElevenLabs as the enabled text-to-speech provider.
 *
 * @param overrides - Optional ElevenLabs settings that override the defaults.
 */
export async function configureElevenLabs(
  overrides: Partial<ProducerConfig["providers"]["tts"]["elevenLabs"]> = {},
): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: {
            ...defaultConfig.providers.tts,
            enabled: true,
            mode: "elevenlabs",
            elevenLabs: { ...defaultConfig.providers.tts.elevenLabs, ...overrides },
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

/**
 * Completes the packaged production workflow for the first generated idea.
 *
 * @returns The identifier of the completed run
 */
export async function preparePackagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}

/**
 * Creates a successful ElevenLabs voice catalog provider fixture.
 *
 * @param overrides - Optional catalog models, subscription, and voices to use instead of the default fixtures.
 * @returns A voice catalog provider that returns a normalized catalog.
 */
export function successfulCatalogProvider(
  overrides: {
    models?: CatalogModel[];
    subscription?: CatalogSubscription;
    voices?: CatalogVoice[];
  } = {},
): VoiceCatalogProvider {
  return {
    provider: "elevenlabs",
    assertReady() {},
    async fetchCatalog(input) {
      return normalizeVoiceCatalog({
        request: input,
        requestIds: ["provider-request-id"],
        models: overrides.models ?? [
          {
            modelId: "eleven_v3",
            canDoTextToSpeech: true,
            canUseStyle: true,
            canUseSpeakerBoost: false,
            maximumTextLengthPerRequest: 5_000,
            maxCharactersRequestFreeUser: 5_000,
            maxCharactersRequestSubscribedUser: 5_000,
            languages: [{ languageId: "tr" }],
            modelRates: { characterCostMultiplier: 1, costDiscountMultiplier: 1 },
          },
        ],
        subscription:
          overrides.subscription ??
          ({
            tier: "free",
            status: "active",
            characterCount: 0,
            characterLimit: 10_000,
            hasOpenInvoices: false,
          } satisfies CatalogSubscription),
        voices: overrides.voices ?? [defaultCatalogVoice()],
      });
    },
  };
}

/**
 * Creates a catalog voice fixture with standard test values.
 *
 * @param overrides - Values that replace the default catalog voice properties
 * @returns A catalog voice fixture
 */
export function defaultCatalogVoice(overrides: Partial<CatalogVoice> = {}): CatalogVoice {
  return {
    voiceId: "voice_catalog_test",
    name: "Catalog Test Voice",
    category: "premade",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/catalog-test.mp3?token=redacted",
    verifiedLanguages: [
      {
        language: "tr",
        modelId: "eleven_v3",
        previewUrl: "https://storage.googleapis.com/eleven-public-prod/catalog-test-tr.mp3",
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a voice preview provider that returns a successful MP3 preview for the catalog's first candidate.
 *
 * @param catalog - The voice catalog containing the candidate used to populate preview metadata.
 * @returns A voice preview provider configured for ElevenLabs.
 */
export function successfulPreviewProvider(catalog: VoiceCandidates): VoicePreviewProvider {
  const candidate = catalog.candidates[0];
  return {
    provider: "elevenlabs",
    assertReady() {},
    async fetchPreview() {
      return {
        audio: previewMp3Bytes(),
        format: "mp3",
        fetchedAt: new Date().toISOString(),
        requestIdHashes: [sha256("raw-preview-request")],
        sourceClass: candidate.preview.sourceClass as "elevenlabs" | "eleven-public-prod",
        sourceUrlSha256: candidate.preview.urlSha256 ?? "",
        voiceMetadataDigest: candidate.metadataDigest,
      };
    },
  };
}

/**
 * Creates a successful ElevenLabs execution metadata provider for tests.
 *
 * @param overrides - Optional catalog models, subscription, and voices used by the provider.
 * @returns An execution metadata provider backed by the configured catalog fixture.
 */
export function successfulExecutionMetadataProvider(
  overrides: Parameters<typeof successfulCatalogProvider>[0] = {},
): VoiceExecutionMetadataProvider {
  const provider = successfulCatalogProvider(overrides);
  return {
    provider: "elevenlabs",
    assertReady: () => provider.assertReady(),
    fetchSnapshot: ({ voiceId: _voiceId, ...request }) => provider.fetchCatalog(request),
  };
}

/**
 * Provides playable MP3 bytes for preview tests.
 *
 * @returns A buffer containing playable MP3 data.
 */
export function previewMp3Bytes(): Buffer {
  return playableMp3Bytes();
}
