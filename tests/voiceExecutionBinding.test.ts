import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readCostEstimate } from "../src/costs/costEstimate";
import { estimateElevenLabsTtsUsd } from "../src/costs/elevenLabsPricing";
import { microsToUsd, usdToMicrosCeil } from "../src/costs/money";
import { estimateCost } from "../src/stages/estimate";
import { readCurrentVoiceSelection } from "../src/stages/voice/catalog/voiceSelectionStore";
import { splitElevenLabsText } from "../src/stages/voice/elevenLabsTextChunks";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import { paidVoiceExecutionEvidenceSchema } from "../src/stages/voice/voiceExecutionEvidence";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { useTempProject } from "./helpers";
import {
  candidateVoiceId,
  preparePaidVoiceSelection,
  prepareVoiceCatalog,
} from "./voiceAuditionStageFixtures";
import {
  configureElevenLabs,
  preparePackagedRun,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("selected voice execution binding", () => {
  useTempProject();

  it("binds the current selection, effective price, and exact prepared-text chunk plan", async () => {
    const { runId, selectionPath } = await preparePaidVoiceSelection();
    const current = await readCurrentVoiceSelection(runId);
    const preparedText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");

    const binding = await buildSelectedVoiceExecutionBinding({
      runId,
      config: await loadConfig(),
      preparedText,
    });

    expect(binding).toMatchObject({
      provider: "elevenlabs",
      selection: { path: selectionPath, digest: current.selection.selectionDigest },
      voice: {
        voiceId: current.selection.voice.voiceId,
        metadataDigest: current.selection.voice.metadataDigest,
      },
      model: {
        modelId: "eleven_v3",
        metadataDigest: current.selection.model.metadataDigest,
        languageCode: "tr",
      },
      synthesis: {
        outputFormat: current.selection.synthesis.outputFormat,
        maxCharactersPerRequest: current.selection.synthesis.maxCharactersPerRequest,
        voiceSettingsDigest: current.selection.synthesis.voiceSettingsDigest,
      },
      pricing: {
        digest: current.selection.pricing.digest,
        effectiveUsdPerThousandCharacters:
          current.selection.pricing.effectiveUsdPerThousandCharacters,
      },
      input: {
        preparedTextDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        characterCount: preparedText.length,
        chunkCount: expect.any(Number),
        chunkPlanDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(binding.input.chunkCount).toBeGreaterThan(0);
    await estimateCost(runId);
    expect(
      (await readCostEstimate(runId)).estimate.stages.find((stage) => stage.stage === "tts"),
    ).toMatchObject({
      bindingDigest: binding.bindingDigest,
      estimatedUsd: estimateElevenLabsTtsUsd(
        preparedText,
        binding.pricing.effectiveUsdPerThousandCharacters,
      ),
    });
    await expect(
      buildSelectedVoiceExecutionBinding({ runId, config: await loadConfig(), preparedText }),
    ).resolves.toEqual(binding);
  });

  it("requires a current run-scoped selection before an ElevenLabs quote", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();

    await expect(estimateCost(runId)).rejects.toThrow(/voice selection|selection.*registered/i);
  });

  it("rejects non-canonical selection and catalog artifact paths in paid evidence", () => {
    const digest = "a".repeat(64);
    const selection = {
      path: "production/audio/voice-selections/selection.json",
      digest,
      catalogPath: "production/audio/voice-candidates/catalog.json",
      catalogDigest: digest,
      voiceMetadataDigest: digest,
      modelMetadataDigest: digest,
      pricingDigest: digest,
      subscriptionDigest: digest,
    };
    const selectionSchema = paidVoiceExecutionEvidenceSchema.shape.selection;

    for (const invalidPath of ["../selection.json", "/tmp/selection.json"]) {
      expect(selectionSchema.safeParse({ ...selection, path: invalidPath }).success).toBe(false);
      expect(selectionSchema.safeParse({ ...selection, catalogPath: invalidPath }).success).toBe(
        false,
      );
    }
  });

  it("uses the persisted selection even when config retains a different candidate voice id", async () => {
    const { runId } = await preparePaidVoiceSelection();
    const current = await readCurrentVoiceSelection(runId);
    await configureElevenLabs({ voiceId: "config_candidate_not_selected" });
    const preparedText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");

    const binding = await buildSelectedVoiceExecutionBinding({
      runId,
      config: await loadConfig(),
      preparedText,
    });

    expect(binding.voice.voiceId).toBe(current.selection.voice.voiceId);
    expect(binding.voice.voiceId).not.toBe("config_candidate_not_selected");
  });

  it("blocks a production quote for a free-tier selection", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "free tier preview only" });

    await expect(estimateCost(runId)).rejects.toThrow(/free tier|production.*eligible/i);
  });

  it("blocks a production quote when the selected subscription quota is insufficient", async () => {
    const { catalog, runId } = await prepareVoiceCatalog({
      subscription: {
        tier: "creator",
        status: "active",
        characterCount: 9_999,
        characterLimit: 10_000,
        hasOpenInvoices: false,
      },
    });
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "operator",
      notes: "quota guard",
      confirmProductionRights: true,
    });

    await expect(estimateCost(runId)).rejects.toThrow(/quota|remaining.*character/i);
  });

  it("approves a conservative maximum rate while retaining the discounted expected rate", async () => {
    await configureElevenLabs({ usdPerThousandCharacters: 0.1 });
    const runId = await preparePackagedRun();
    const catalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({
        models: [
          {
            modelId: "eleven_v3",
            canDoTextToSpeech: true,
            canUseStyle: true,
            canUseSpeakerBoost: false,
            maximumTextLengthPerRequest: 5_000,
            maxCharactersRequestSubscribedUser: 5_000,
            languages: [{ languageId: "tr" }],
            modelRates: { characterCostMultiplier: 1.25, costDiscountMultiplier: 0.5 },
          },
        ],
        subscription: {
          tier: "creator",
          status: "active",
          characterCount: 0,
          characterLimit: 100_000,
          hasOpenInvoices: false,
        },
      }),
    });
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "operator",
      notes: "conservative maximum quote",
      confirmProductionRights: true,
    });
    const preparedText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");
    const binding = await buildSelectedVoiceExecutionBinding({
      runId,
      config: await loadConfig(),
      preparedText,
    });

    expect(binding.pricing).toMatchObject({
      effectiveUsdPerThousandCharacters: 0.0625,
      maximumUsdPerThousandCharacters: 0.125,
    });
    const maximumBillableCredits = splitElevenLabsText(
      preparedText,
      binding.synthesis.maxCharactersPerRequest,
    ).reduce((total, chunk) => total + Math.ceil(chunk.length * 1.25), 0);
    await estimateCost(runId);
    expect(
      (await readCostEstimate(runId)).estimate.stages.find((stage) => stage.stage === "tts"),
    ).toMatchObject({
      estimatedUsd: microsToUsd(usdToMicrosCeil((maximumBillableCredits / 1_000) * 0.1)),
    });
  });
});
