import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: sdk.convertWithTimestamps };
  },
}));

import { loadConfig } from "../src/config/config";
import { artifactPath, writeRunJson, writeRunText } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import {
  buildCostEstimate,
  readCostEstimate,
  validateCurrentCostEstimate,
} from "../src/costs/costEstimate";
import { archiveActiveCostEstimate } from "../src/costs/costEstimateHistory";
import { validateCostEstimateIntegrity } from "../src/costs/costEstimateIntegrity";
import { renderCostEstimateMarkdown } from "../src/costs/costEstimatePresentation";
import {
  appendCostReservationEvent,
  readCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { executeReservedProviderOperation } from "../src/costs/reservedProviderExecution";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { recoverCommittedVoiceExecution } from "../src/stages/voice/voiceExecutionRecovery";
import { readVoiceoverAudioEvidence } from "../src/stages/voice/voiceoverEvidence";
import { sha256 } from "../src/utils/hash";
import {
  approvedHostedVoiceConfirmation,
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
  workflowConvertWithTimestamps,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { successfulExecutionMetadataProvider } from "./voiceCatalogStageFixtures";

describe("ElevenLabs voice workflow recovery", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-workflow-test-key";
    sdk.convertWithTimestamps.mockImplementation(workflowConvertWithTimestamps);
  });

  it("recovers a settled provider result after a crash before final artifact persistence", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const metadataProvider = successfulExecutionMetadataProvider({
      subscription: paidVoiceSubscription,
    });

    await expect(
      generateVoiceoverAudio(runId, {
        confirmation: await approvedHostedVoiceConfirmation(runId),
        metadataProvider,
        afterSynthesis: async () => {
          throw new Error("simulated process crash before final voice files");
        },
      }),
    ).rejects.toThrow(/simulated process crash/i);
    const callsAfterSettledCrash = sdk.convertWithTimestamps.mock.calls.length;
    expect(callsAfterSettledCrash).toBeGreaterThan(0);
    expect(await readCostReservationSummaries(runId)).toContainEqual(
      expect.objectContaining({ status: "SETTLED" }),
    );

    const changedConfig = JSON.parse(await readFile("producer.config.json", "utf8")) as {
      providers: { tts: { enabled: boolean; mode: string } };
    };
    changedConfig.providers.tts.enabled = false;
    changedConfig.providers.tts.mode = "deterministic-local";
    await writeFile("producer.config.json", `${JSON.stringify(changedConfig, null, 2)}\n`, "utf8");
    delete process.env.ELEVENLABS_API_KEY;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1_000);
      await expect(generateVoiceoverAudio(runId)).resolves.toMatchObject({
        mode: "elevenlabs",
        paidExecution: { reservationStatus: "SETTLED" },
      });
    } finally {
      vi.useRealTimers();
    }
    expect(sdk.convertWithTimestamps).toHaveBeenCalledTimes(callsAfterSettledCrash);
  });

  it("finalizes a committed provider result after a crash before settlement", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();

    await expect(
      generateVoiceoverAudio(runId, {
        confirmation: await approvedHostedVoiceConfirmation(runId),
        metadataProvider: successfulExecutionMetadataProvider({
          subscription: paidVoiceSubscription,
        }),
        afterResultCommitted: async () => {
          throw new Error("simulated crash after result commit");
        },
      }),
    ).rejects.toThrow(/simulated crash after result commit/i);
    const callsAfterCommit = sdk.convertWithTimestamps.mock.calls.length;
    expect(await readCostReservationSummaries(runId)).toContainEqual(
      expect.objectContaining({
        status: "SETTLEMENT_PENDING",
        resultEvidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );

    delete process.env.ELEVENLABS_API_KEY;
    await expect(generateVoiceoverAudio(runId)).resolves.toMatchObject({
      mode: "elevenlabs",
      paidExecution: { reservationStatus: "SETTLED" },
    });
    expect(sdk.convertWithTimestamps).toHaveBeenCalledTimes(callsAfterCommit);
  });

  it("keeps settled voice evidence recoverable after a newer quote becomes active", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    await generateVoiceoverAudio(runId, {
      confirmation: await approvedHostedVoiceConfirmation(runId),
      metadataProvider: successfulExecutionMetadataProvider({
        subscription: paidVoiceSubscription,
      }),
    });
    const providerCalls = sdk.convertWithTimestamps.mock.calls.length;
    const config = await loadConfig();
    const originalQuote = await readCostEstimate(runId);
    let run = await loadRun(runId);
    await expect(
      validateCurrentCostEstimate(run, config, originalQuote.estimate, originalQuote.digest),
    ).resolves.toEqual([]);
    await expect(
      validateCostEstimateIntegrity(run, config, originalQuote.estimate),
    ).resolves.toEqual([]);

    const archived = await archiveActiveCostEstimate({ run, stage: "test-quote-rollover" });
    run = archived.run;
    const nextQuote = await buildCostEstimate(run, config);
    expect(nextQuote.stages.find((stage) => stage.stage === "tts")).toMatchObject({
      bindingSummary: { kind: "settled-paid-stage", originalQuoteDigest: originalQuote.digest },
      enabled: false,
      estimatedUsd: 0,
      provider: "elevenlabs",
    });
    run = await writeRunJson(run, "test-quote-rollover", "costs/estimate.json", nextQuote);
    run = await writeRunText(
      run,
      "test-quote-rollover",
      "costs/estimate.md",
      renderCostEstimateMarkdown(nextQuote),
    );
    await saveRun(run);

    await expect(readVoiceoverAudioEvidence(await loadRun(runId))).resolves.toMatchObject({
      status: "pass",
      mode: "elevenlabs",
    });
    await expect(generateVoiceoverAudio(runId)).resolves.toMatchObject({
      mode: "elevenlabs",
      paidExecution: { quoteDigest: originalQuote.digest, reservationStatus: "SETTLED" },
    });
    expect(sdk.convertWithTimestamps).toHaveBeenCalledTimes(providerCalls);
  });

  it("ignores released history when one committed voice execution can be recovered", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    await generateVoiceoverAudio(runId, {
      confirmation: await approvedHostedVoiceConfirmation(runId),
      metadataProvider: successfulExecutionMetadataProvider({
        subscription: paidVoiceSubscription,
      }),
    });
    const providerCalls = sdk.convertWithTimestamps.mock.calls.length;
    const settled = (await readCostReservationSummaries(runId)).find(
      (reservation) => reservation.stage === "tts" && reservation.status === "SETTLED",
    );
    if (!settled?.model || !settled.bindingDigest) {
      throw new Error("Expected a settled, bound voice reservation fixture.");
    }
    const releasedReservationId = "reservation_released_voice_history";
    const createdAt = new Date().toISOString();
    await appendCostReservationEvent({
      eventId: "reservation_event_released_voice_history_reserved",
      reservationId: releasedReservationId,
      runId,
      type: "RESERVED",
      operationId: "voice_released_historical_operation",
      approvalId: settled.approvalId,
      quoteDigest: settled.quoteDigest,
      stage: "tts",
      provider: settled.provider,
      model: settled.model,
      bindingDigest: settled.bindingDigest,
      maxUsdMicros: settled.maxUsdMicros,
      createdAt,
    });
    await appendCostReservationEvent({
      eventId: "reservation_event_released_voice_history_released",
      reservationId: releasedReservationId,
      runId,
      type: "RELEASED",
      reason: "provider proved that the historical request was never sent",
      createdAt,
    });

    delete process.env.ELEVENLABS_API_KEY;
    await expect(generateVoiceoverAudio(runId)).resolves.toMatchObject({
      mode: "elevenlabs",
      paidExecution: { reservationStatus: "SETTLED", quoteDigest: settled.quoteDigest },
    });
    expect(sdk.convertWithTimestamps).toHaveBeenCalledTimes(providerCalls);
  });

  it("treats released-only history as no committed recovery candidate", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const quote = await readCostEstimate(runId);
    const tts = quote.estimate.stages.find((stage) => stage.stage === "tts");
    if (!tts?.model || !tts.bindingDigest) {
      throw new Error("Expected a bound TTS quote fixture.");
    }
    await executeReservedProviderOperation({
      runId,
      stage: "tts",
      operationId: "voice_released_only_history",
      timeoutMs: 100,
      adapter: {
        provider: tts.provider,
        model: tts.model,
        bindingDigest: tts.bindingDigest,
        async execute() {
          return { kind: "definitely-not-sent", reason: "connection-not-opened" };
        },
      },
    });
    const sourceText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");

    await expect(
      recoverCommittedVoiceExecution({
        run: await loadRun(runId),
        sourceDigest: sha256(sourceText),
      }),
    ).resolves.toBeUndefined();
  });
});
