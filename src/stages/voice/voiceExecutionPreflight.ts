import { z } from "zod";

import { SafeExitError } from "../../core/errors.js";
import type { VoiceCatalogProviderResult } from "./catalog/voiceCatalogContracts.js";
import { sha256Schema, voiceCatalogProviderResultSchema } from "./catalog/voiceCatalogContracts.js";
import { canonicalVoiceEvidenceDigest } from "./catalog/voiceCatalogDigest.js";
import type { VoiceCatalogRequest } from "./catalog/voiceCatalogProvider.js";
import { ElevenLabsVoiceExecutionMetadataProvider } from "./providers/elevenLabsVoiceExecutionMetadataProvider.js";
import type { SelectedVoiceExecutionBinding } from "./voiceExecutionBinding.js";

export interface VoiceExecutionMetadataProvider {
  readonly provider: "elevenlabs";
  assertReady(): void;
  fetchSnapshot(
    input: VoiceCatalogRequest & { voiceId: string },
  ): Promise<VoiceCatalogProviderResult>;
}

export const voiceExecutionPreflightReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1),
  provider: z.literal("elevenlabs"),
  validatedAt: z.iso.datetime(),
  bindingDigest: sha256Schema,
  requestIdHashes: z.array(sha256Schema).max(16),
  voiceMetadataDigest: sha256Schema,
  modelMetadataDigest: sha256Schema,
  pricingDigest: sha256Schema,
  subscription: z.strictObject({
    digest: sha256Schema,
    characterCount: z.int().nonnegative().max(1_000_000_000),
    characterLimit: z.int().nonnegative().max(1_000_000_000),
    remainingCharacters: z.int().nonnegative().max(1_000_000_000),
  }),
  validationDigest: sha256Schema,
});

export type VoiceExecutionPreflightReceipt = z.infer<typeof voiceExecutionPreflightReceiptSchema>;

/** Parses a live preflight receipt and verifies its canonical redacted digest. */
export function requireVoiceExecutionPreflightReceipt(
  value: unknown,
): VoiceExecutionPreflightReceipt {
  const receipt = voiceExecutionPreflightReceiptSchema.parse(value);
  const { validationDigest, ...digestInput } = receipt;
  if (canonicalVoiceEvidenceDigest(digestInput) !== validationDigest) {
    throw new SafeExitError("Voice execution preflight receipt digest is invalid.");
  }
  return receipt;
}

/** Verifies that a redacted live receipt authorizes this exact execution binding. */
export function requireMatchingVoiceExecutionPreflight(
  value: unknown,
  binding: SelectedVoiceExecutionBinding,
): VoiceExecutionPreflightReceipt {
  const receipt = requireVoiceExecutionPreflightReceipt(value);
  const remainingCharacters = Math.max(
    0,
    receipt.subscription.characterLimit - receipt.subscription.characterCount,
  );
  if (
    receipt.bindingDigest !== binding.bindingDigest ||
    receipt.voiceMetadataDigest !== binding.voice.metadataDigest ||
    receipt.modelMetadataDigest !== binding.model.metadataDigest ||
    receipt.pricingDigest !== binding.pricing.digest ||
    receipt.subscription.characterLimit !== binding.subscription.characterLimit ||
    receipt.subscription.remainingCharacters !== remainingCharacters ||
    receipt.subscription.remainingCharacters < binding.input.characterCount
  ) {
    throw new SafeExitError(
      "Live voice execution preflight does not match the approved execution binding.",
    );
  }
  return receipt;
}

/** Revalidates the selected voice through bounded read-only provider metadata before reservation. */
export async function revalidateSelectedVoiceExecutionBinding(input: {
  binding: SelectedVoiceExecutionBinding;
  provider?: VoiceExecutionMetadataProvider;
}): Promise<VoiceExecutionPreflightReceipt> {
  const provider = input.provider ?? new ElevenLabsVoiceExecutionMetadataProvider();
  provider.assertReady();
  const live = voiceCatalogProviderResultSchema.parse(
    await provider.fetchSnapshot({
      voiceId: input.binding.voice.voiceId,
      languageCode: input.binding.model.languageCode,
      maxCandidates: 1,
      maxCharactersPerRequest: input.binding.synthesis.maxCharactersPerRequest,
      modelId: input.binding.model.modelId,
      usdPerThousandCharacters: input.binding.pricing.baseUsdPerThousandCharacters,
    }),
  );
  if (live.provider !== provider.provider) {
    throw new SafeExitError("Live voice metadata provider identity changed before synthesis.");
  }
  requireStableSubscription(input.binding, live);
  if (live.model.metadataDigest !== input.binding.model.metadataDigest) {
    throw new SafeExitError("ElevenLabs model metadata changed after cost approval.");
  }
  if (live.pricing.digest !== input.binding.pricing.digest) {
    throw new SafeExitError("ElevenLabs pricing metadata changed after cost approval.");
  }
  const liveVoice = live.candidates.find(
    (candidate) => candidate.voiceId === input.binding.voice.voiceId,
  );
  if (liveVoice?.metadataDigest !== input.binding.voice.metadataDigest) {
    throw new SafeExitError("Selected voice metadata changed; the approved selection is stale.");
  }
  if (
    liveVoice.productionEligibility.status === "blocked" ||
    liveVoice.productionEligibility.status === "preview-only"
  ) {
    throw new SafeExitError("Selected voice is no longer eligible for production synthesis.");
  }
  const remainingCharacters = Math.max(
    0,
    live.subscription.characterLimit - live.subscription.characterCount,
  );
  if (input.binding.input.characterCount > remainingCharacters) {
    throw new SafeExitError(
      `ElevenLabs live remaining character quota is insufficient (${remainingCharacters} available, ${input.binding.input.characterCount} required).`,
    );
  }
  const receiptInput = {
    schemaVersion: 1 as const,
    provider: "elevenlabs" as const,
    validatedAt: live.fetchedAt,
    bindingDigest: input.binding.bindingDigest,
    requestIdHashes: live.requestIdHashes,
    voiceMetadataDigest: liveVoice.metadataDigest,
    modelMetadataDigest: live.model.metadataDigest,
    pricingDigest: live.pricing.digest,
    subscription: {
      digest: live.subscription.digest,
      characterCount: live.subscription.characterCount,
      characterLimit: live.subscription.characterLimit,
      remainingCharacters,
    },
  };
  return requireVoiceExecutionPreflightReceipt({
    ...receiptInput,
    validationDigest: canonicalVoiceEvidenceDigest(receiptInput),
  });
}

function requireStableSubscription(
  binding: SelectedVoiceExecutionBinding,
  live: VoiceCatalogProviderResult,
): void {
  const expected = binding.subscription;
  const current = live.subscription;
  if (
    current.tier !== expected.tier ||
    current.status !== expected.status ||
    current.characterLimit !== expected.characterLimit ||
    current.currency !== expected.currency ||
    current.hasOpenInvoices !== expected.hasOpenInvoices ||
    current.productionUseStatus !== expected.productionUseStatus
  ) {
    throw new SafeExitError(
      "ElevenLabs subscription tier or billing metadata changed after approval.",
    );
  }
}
