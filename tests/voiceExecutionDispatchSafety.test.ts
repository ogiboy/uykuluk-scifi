import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import type { ReservedProviderAdapter } from "../src/costs/reservedProviderExecution";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import type {
  ReservedTtsProvider,
  TtsSynthesisResult,
} from "../src/stages/voice/providers/ttsProvider";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import { createVoiceExecutionOperationId } from "../src/stages/voice/voiceExecutionOperation";
import { revalidateSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionPreflight";
import { synthesizeVoiceover } from "../src/stages/voice/voiceSynthesisExecution";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";
import { pathExists } from "../src/utils/fs";
import {
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import {
  defaultCatalogVoice,
  successfulExecutionMetadataProvider,
} from "./voiceCatalogStageFixtures";

describe("voice execution dispatch safety", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-dispatch-test-key";
  });

  it("blocks live voice drift before reservation, synthesis, or audio persistence", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();

    await expect(
      generateVoiceoverAudio(runId, {
        metadataProvider: successfulExecutionMetadataProvider({
          subscription: paidVoiceSubscription,
          voices: [defaultCatalogVoice({ name: "Provider Changed Voice" })],
        }),
      }),
    ).rejects.toThrow(/voice.*metadata|selection.*stale/i);

    expect(await readCostReservationSummaries(runId)).toEqual([]);
    expect(await pathExists(artifactPath(runId, "production/audio/voiceover.wav"))).toBe(false);
    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "GUARD_BLOCKED",
        stage: "voice-execution-preflight",
        data: expect.objectContaining({ bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      }),
    );
  });

  it("rechecks the exact approved text and chunk plan before creating a reservation", async () => {
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
    const execute = vi.fn(async () => ({
      kind: "definitely-not-sent" as const,
      reason: "adapter-validation" as const,
    }));

    await expect(
      synthesizeVoiceover(
        reservedProvider(binding.bindingDigest, execute),
        { runId, text: `${preparedText}\nchanged after approval` },
        {
          preparationDigest: binding.input.preparedTextDigest,
          binding,
          preflight,
          approvedQuote: await approvedQuote(runId),
          preparation,
        },
      ),
    ).rejects.toThrow(/prepared text|chunk plan|execution binding/i);

    expect(execute).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("blocks synthesis-setting drift against the exact approved quote", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
      providers: { tts: { elevenLabs: Record<string, unknown> } };
    };
    config.providers.tts.elevenLabs.seed = 99;
    await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");

    await expect(
      generateVoiceoverAudio(runId, {
        metadataProvider: successfulExecutionMetadataProvider({
          subscription: paidVoiceSubscription,
        }),
      }),
    ).rejects.toThrow(/approved.*quote|quote.*binding|synthesis configuration/i);

    expect(await readCostReservationSummaries(runId)).toEqual([]);
    expect(await readLedger(runId)).toContainEqual(
      expect.objectContaining({
        type: "GUARD_BLOCKED",
        stage: "voice-execution-preflight",
        data: expect.objectContaining({
          reason: "approved-quote-validation-failed",
          currentBindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          currentProvider: "elevenlabs",
          currentModel: "eleven_v3",
        }),
      }),
    );
  });

  it("records redacted diagnostics when the live metadata provider fails", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const error = await generateVoiceoverAudio(runId, {
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

async function exactPreparation(runId: string) {
  return prepareVoiceoverText({
    runId,
    sourceText: await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8"),
    pronunciationReplacements: {},
  });
}

function reservedProvider(
  bindingDigest: string,
  execute: ReservedProviderAdapter<TtsSynthesisResult>["execute"],
): ReservedTtsProvider {
  return {
    mode: "elevenlabs",
    executionPolicy: "reserved-paid",
    assertReady: vi.fn(),
    createReservedAdapter: () => ({
      provider: "elevenlabs",
      model: "eleven_v3",
      bindingDigest,
      execute,
    }),
  };
}

async function approvedQuote(runId: string): Promise<{ quoteDigest: string; approvalId: string }> {
  const quoteDigest = (await readCostEstimate(runId)).digest;
  const approval = (await loadRun(runId)).approvals.find(
    (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
  );
  if (!approval) throw new Error("Expected paid quote approval fixture.");
  return { quoteDigest, approvalId: approval.approvalId };
}
