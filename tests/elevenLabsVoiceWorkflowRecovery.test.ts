import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: sdk.convertWithTimestamps };
  },
}));

import { loadConfig } from "../src/config/config";
import { writeRunJson, writeRunText } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { buildCostEstimate, readCostEstimate } from "../src/costs/costEstimate";
import { archiveActiveCostEstimate } from "../src/costs/costEstimateHistory";
import { validateCostEstimateIntegrity } from "../src/costs/costEstimateIntegrity";
import { renderCostEstimateMarkdown } from "../src/costs/costEstimatePresentation";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { readVoiceoverAudioEvidence } from "../src/stages/voice/voiceoverEvidence";
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
});
