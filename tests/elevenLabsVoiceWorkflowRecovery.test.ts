import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: sdk.convertWithTimestamps };
  },
}));

import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { generateVoiceoverAudio } from "../src/stages/voice";
import {
  approvedHostedVoiceConfirmation,
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
  workflowFixtureWav,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { successfulExecutionMetadataProvider } from "./voiceCatalogStageFixtures";

describe("ElevenLabs voice workflow recovery", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-workflow-test-key";
    sdk.convertWithTimestamps.mockImplementation((_voiceId, request) => {
      const characters = Array.from(request.text as string);
      const durationSeconds = Math.max(1, characters.length / 14);
      return {
        withRawResponse: async () => ({
          data: {
            audioBase64: workflowFixtureWav(Math.ceil(durationSeconds)).toString("base64"),
            alignment: {
              characters,
              characterStartTimesSeconds: characters.map(
                (_, index) => (index / characters.length) * durationSeconds,
              ),
              characterEndTimesSeconds: characters.map(
                (_, index) => ((index + 1) / characters.length) * durationSeconds,
              ),
            },
            normalizedAlignment: {
              characters,
              characterStartTimesSeconds: characters.map(
                (_, index) => (index / characters.length) * durationSeconds,
              ),
              characterEndTimesSeconds: characters.map(
                (_, index) => ((index + 1) / characters.length) * durationSeconds,
              ),
            },
          },
          rawResponse: {
            headers: new Headers({
              "character-cost": String(characters.length),
              "request-id": "workflow-request-id",
            }),
          },
        }),
      };
    });
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
});
