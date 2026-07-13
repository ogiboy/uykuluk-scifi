import { z } from "zod";

import type { ProducerConfig } from "../../config/schema.js";
import { SafeExitError } from "../../core/errors.js";
import { sha256 } from "../../utils/hash.js";
import {
  isVoiceSelectionArtifactPath,
  voiceSelectionPath,
} from "./catalog/voiceAuditionContracts.js";
import {
  pricingSnapshotSchema,
  providerIdentifierSchema,
  sha256Schema,
  voiceIdSchema,
} from "./catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import { readCurrentVoiceSelection } from "./catalog/voiceSelectionStore.js";
import { splitElevenLabsText } from "./elevenLabsTextChunks.js";
import type { ElevenLabsTtsProviderConfig } from "./providers/elevenLabsTtsContracts.js";
import { wavOutputFormatSchema } from "./providers/elevenLabsTtsContracts.js";

const voiceSelectionArtifactPathSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(isVoiceSelectionArtifactPath, "Invalid voice selection artifact path.");

const nonnegativeBoundedInteger = z.int().nonnegative().max(1_000_000_000);

export const selectedVoiceExecutionBindingSchema = z.strictObject({
  schemaVersion: z.literal(1),
  provider: z.literal("elevenlabs"),
  selection: z.strictObject({
    path: z.union([z.literal(voiceSelectionPath), voiceSelectionArtifactPathSchema]),
    digest: sha256Schema,
  }),
  catalog: z.strictObject({ path: z.string().min(1).max(300), digest: sha256Schema }),
  voice: z.strictObject({ voiceId: voiceIdSchema, metadataDigest: sha256Schema }),
  model: z.strictObject({
    modelId: providerIdentifierSchema,
    metadataDigest: sha256Schema,
    languageCode: z.literal("tr"),
    maximumTextLengthPerRequest: z.int().positive().max(100_000),
  }),
  synthesis: z.strictObject({
    outputFormat: wavOutputFormatSchema,
    maxCharactersPerRequest: z.int().min(250).max(5_000),
    voiceSettingsDigest: sha256Schema,
    applyTextNormalization: z.enum(["auto", "on", "off"]),
    seed: z.int().nonnegative().max(4_294_967_295),
    timeoutMs: z.int().positive().max(600_000),
    maxRetries: z.literal(0),
  }),
  pricing: pricingSnapshotSchema,
  subscription: z.strictObject({
    tier: z.string().min(1).max(80),
    status: z.string().min(1).max(80),
    currency: z.string().min(1).max(16).optional(),
    hasOpenInvoices: z.literal(false),
    digest: sha256Schema,
    productionUseStatus: z.literal("operator-rights-required"),
    characterCount: nonnegativeBoundedInteger,
    characterLimit: nonnegativeBoundedInteger,
    remainingCharacters: nonnegativeBoundedInteger,
  }),
  input: z.strictObject({
    preparedTextDigest: sha256Schema,
    characterCount: z.int().positive().max(1_000_000_000),
    chunkCount: z.int().positive().max(10_000),
    chunkPlanDigest: sha256Schema,
  }),
  bindingDigest: sha256Schema,
});

export type SelectedVoiceExecutionBinding = z.infer<typeof selectedVoiceExecutionBindingSchema>;

/** Parses a persisted binding and verifies its canonical digest before it reaches a provider. */
export function requireSelectedVoiceExecutionBinding(
  value: unknown,
): SelectedVoiceExecutionBinding {
  const binding = selectedVoiceExecutionBindingSchema.parse(value);
  const { bindingDigest, ...digestInput } = binding;
  if (canonicalVoiceEvidenceDigest(digestInput) !== bindingDigest) {
    throw new SafeExitError("Selected voice execution binding digest is invalid.");
  }
  return binding;
}

/** Recomputes every text-derived field before a paid adapter can reserve or dispatch. */
export function requireMatchingVoiceExecutionInput(
  value: unknown,
  input: { preparedText: string; preparationDigest: string },
): SelectedVoiceExecutionBinding {
  const binding = requireSelectedVoiceExecutionBinding(value);
  const chunks = splitElevenLabsText(input.preparedText, binding.synthesis.maxCharactersPerRequest);
  const chunkPlan = chunks.map((chunk, index) => ({
    index,
    characterCount: chunk.length,
    digest: sha256(chunk),
  }));
  if (
    input.preparationDigest !== binding.input.preparedTextDigest ||
    sha256(input.preparedText) !== binding.input.preparedTextDigest ||
    input.preparedText.length !== binding.input.characterCount ||
    chunks.length !== binding.input.chunkCount ||
    canonicalVoiceEvidenceDigest(chunkPlan) !== binding.input.chunkPlanDigest
  ) {
    throw new SafeExitError(
      "Prepared text or chunk plan does not match the approved voice execution binding.",
    );
  }
  return binding;
}

/** Resolves provider configuration from a verified run binding; config voiceId is never consulted. */
export function elevenLabsConfigFromBinding(
  config: ProducerConfig["providers"]["tts"],
  value: unknown,
): ElevenLabsTtsProviderConfig {
  const binding = requireSelectedVoiceExecutionBinding(value);
  if (!config.enabled || config.mode !== "elevenlabs") {
    throw new SafeExitError("Selected voice binding requires enabled ElevenLabs TTS.");
  }
  const current = config.elevenLabs;
  if (
    current.modelId !== binding.model.modelId ||
    current.languageCode !== binding.model.languageCode ||
    current.outputFormat !== binding.synthesis.outputFormat ||
    current.maxCharactersPerRequest !== binding.synthesis.maxCharactersPerRequest ||
    current.applyTextNormalization !== binding.synthesis.applyTextNormalization ||
    current.seed !== binding.synthesis.seed ||
    current.timeoutMs !== binding.synthesis.timeoutMs ||
    current.maxRetries !== binding.synthesis.maxRetries ||
    current.usdPerThousandCharacters !== binding.pricing.baseUsdPerThousandCharacters ||
    canonicalVoiceEvidenceDigest(current.voiceSettings) !== binding.synthesis.voiceSettingsDigest
  ) {
    throw new SafeExitError("ElevenLabs synthesis configuration changed after voice selection.");
  }
  return {
    bindingDigest: binding.bindingDigest,
    voiceId: binding.voice.voiceId,
    modelId: binding.model.modelId,
    languageCode: binding.model.languageCode,
    applyTextNormalization: binding.synthesis.applyTextNormalization,
    seed: binding.synthesis.seed,
    maxCharactersPerRequest: binding.synthesis.maxCharactersPerRequest,
    outputFormat: binding.synthesis.outputFormat,
    timeoutMs: binding.synthesis.timeoutMs,
    maxRetries: binding.synthesis.maxRetries,
    maximumUsdPerThousandCharacters: binding.pricing.maximumUsdPerThousandCharacters,
    billedCreditUsdPerThousandCharacters: binding.pricing.baseUsdPerThousandCharacters,
    voiceSettings: current.voiceSettings,
  };
}

/** Builds the deterministic paid-TTS identity from the current run selection and prepared text. */
export async function buildSelectedVoiceExecutionBinding(input: {
  runId: string;
  config: ProducerConfig;
  preparedText: string;
}): Promise<SelectedVoiceExecutionBinding> {
  const current = await readCurrentVoiceSelection(input.runId, { config: input.config });
  const { catalog, selection } = current;
  const tts = input.config.providers.tts;
  if (!tts.enabled || tts.mode !== "elevenlabs") {
    throw new SafeExitError("Selected voice execution requires enabled ElevenLabs TTS.");
  }
  if (selection.subscription.productionUseStatus !== "operator-rights-required") {
    throw new SafeExitError(
      "Free tier voice output is not eligible for the production synthesis workflow.",
    );
  }
  if (!selection.productionRights.confirmed) {
    throw new SafeExitError("Production voice usage rights have not been confirmed.");
  }
  if (
    selection.voice.productionEligibility.status === "blocked" ||
    selection.voice.productionEligibility.status === "preview-only"
  ) {
    throw new SafeExitError("Selected voice is not eligible for production synthesis.");
  }

  const chunks = splitElevenLabsText(
    input.preparedText,
    selection.synthesis.maxCharactersPerRequest,
  );
  const characterCount = input.preparedText.length;
  const remainingCharacters = Math.max(
    0,
    catalog.subscription.characterLimit - catalog.subscription.characterCount,
  );
  if (characterCount > remainingCharacters) {
    throw new SafeExitError(
      `ElevenLabs remaining character quota is insufficient for production synthesis (${remainingCharacters} available, ${characterCount} required).`,
    );
  }

  const chunkPlan = chunks.map((chunk, index) => ({
    index,
    characterCount: chunk.length,
    digest: sha256(chunk),
  }));
  const bindingInput = {
    schemaVersion: 1 as const,
    provider: "elevenlabs" as const,
    selection: { path: current.selectionPath, digest: selection.selectionDigest },
    catalog: { path: current.catalogPath, digest: catalog.catalogDigest },
    voice: { voiceId: selection.voice.voiceId, metadataDigest: selection.voice.metadataDigest },
    model: {
      modelId: selection.model.modelId,
      metadataDigest: selection.model.metadataDigest,
      languageCode: selection.model.languageCode,
      maximumTextLengthPerRequest: selection.model.maximumTextLengthPerRequest,
    },
    synthesis: {
      outputFormat: selection.synthesis.outputFormat,
      maxCharactersPerRequest: selection.synthesis.maxCharactersPerRequest,
      voiceSettingsDigest: selection.synthesis.voiceSettingsDigest,
      applyTextNormalization: tts.elevenLabs.applyTextNormalization,
      seed: tts.elevenLabs.seed,
      timeoutMs: tts.elevenLabs.timeoutMs,
      maxRetries: tts.elevenLabs.maxRetries,
    },
    pricing: selection.pricing,
    subscription: {
      tier: selection.subscription.tier,
      status: catalog.subscription.status,
      ...(catalog.subscription.currency ? { currency: catalog.subscription.currency } : {}),
      hasOpenInvoices: false as const,
      digest: selection.subscription.digest,
      productionUseStatus: selection.subscription.productionUseStatus,
      characterCount: catalog.subscription.characterCount,
      characterLimit: catalog.subscription.characterLimit,
      remainingCharacters,
    },
    input: {
      preparedTextDigest: sha256(input.preparedText),
      characterCount,
      chunkCount: chunks.length,
      chunkPlanDigest: canonicalVoiceEvidenceDigest(chunkPlan),
    },
  };
  return requireSelectedVoiceExecutionBinding({
    ...bindingInput,
    bindingDigest: canonicalVoiceEvidenceDigest(bindingInput),
  });
}
