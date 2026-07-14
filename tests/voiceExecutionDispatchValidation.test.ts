import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/config";
import { readLedger } from "../src/core/ledger";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import { createVoiceExecutionOperationId } from "../src/stages/voice/voiceExecutionOperation";
import { revalidateSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionPreflight";
import { synthesizeVoiceover } from "../src/stages/voice/voiceSynthesisExecution";
import {
  approvedHostedVoiceConfirmation,
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { successfulExecutionMetadataProvider } from "./voiceCatalogStageFixtures";
import {
  approvedQuote,
  exactPreparation,
  reservedProvider,
} from "./voiceExecutionDispatchFixtures";

const initialElevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

describe("voice execution dispatch validation", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-dispatch-test-key";
  });

  afterEach(() => {
    if (initialElevenLabsApiKey === undefined) {
      delete process.env.ELEVENLABS_API_KEY;
      return;
    }
    process.env.ELEVENLABS_API_KEY = initialElevenLabsApiKey;
  });

  it("records redacted diagnostics when the live metadata provider fails", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const error = await generateVoiceoverAudio(runId, {
      confirmation: await approvedHostedVoiceConfirmation(runId),
      metadataProvider: {
        provider: "elevenlabs",
        assertReady() {},
        async fetchSnapshot() {
          throw new Error("secret-dispatch-test-key raw provider response");
        },
      },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/metadata refresh failed safely/i);
    expect((error as Error).message).not.toContain("secret-dispatch-test-key");
    expect(JSON.stringify(await readLedger(runId))).not.toContain("secret-dispatch-test-key");
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("validates every live receipt digest against the approved binding before reservation", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const preparation = await exactPreparation(runId);
    const preparedText = preparation.text;
    const binding = await buildSelectedVoiceExecutionBinding({
      runId,
      config: await loadConfig(),
      preparedText,
    });
    const preflight = await revalidateSelectedVoiceExecutionBinding({
      binding,
      provider: successfulExecutionMetadataProvider({ subscription: paidVoiceSubscription }),
    });
    const { validationDigest: _ignored, ...receiptInput } = preflight;
    const tamperedReceiptInput = { ...receiptInput, voiceMetadataDigest: "f".repeat(64) };
    const execute = vi.fn(async () => ({
      kind: "definitely-not-sent" as const,
      reason: "adapter-validation" as const,
    }));

    await expect(
      synthesizeVoiceover(
        reservedProvider(binding.bindingDigest, execute),
        { runId, text: preparedText },
        {
          preparationDigest: binding.input.preparedTextDigest,
          binding,
          approvedQuote: await approvedQuote(runId),
          preflight: {
            ...tamperedReceiptInput,
            validationDigest: canonicalVoiceEvidenceDigest(tamperedReceiptInput),
          },
          preparation,
        },
      ),
    ).rejects.toThrow(/preflight|voice metadata|execution binding/i);

    expect(execute).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("derives a new operation identity for each exact quote approval", () => {
    const common = {
      runId: "run_20260713_operation",
      preparationDigest: "a".repeat(64),
      bindingDigest: "b".repeat(64),
    };

    expect(
      createVoiceExecutionOperationId({
        ...common,
        quoteDigest: "c".repeat(64),
        approvalId: "approval_one",
      }),
    ).not.toBe(
      createVoiceExecutionOperationId({
        ...common,
        quoteDigest: "d".repeat(64),
        approvalId: "approval_two",
      }),
    );
  });
});
