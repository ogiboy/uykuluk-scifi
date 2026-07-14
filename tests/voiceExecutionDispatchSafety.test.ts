import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import { revalidateSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionPreflight";
import { prepareVoiceExecution } from "../src/stages/voice/voiceExecutionPreparation";
import { synthesizeVoiceover } from "../src/stages/voice/voiceSynthesisExecution";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";
import { pathExists } from "../src/utils/fs";
import {
  approvedHostedVoiceConfirmation,
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import {
  defaultCatalogVoice,
  successfulExecutionMetadataProvider,
} from "./voiceCatalogStageFixtures";
import {
  approvedQuote,
  exactPreparation,
  reservedProvider,
} from "./voiceExecutionDispatchFixtures";

describe("voice execution dispatch safety", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-dispatch-test-key";
  });

  it("blocks a new hosted synthesis when exact paid-operation confirmation is missing", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const provider = successfulExecutionMetadataProvider({ subscription: paidVoiceSubscription });
    const fetchSnapshot = vi.fn(provider.fetchSnapshot.bind(provider));

    await expect(
      generateVoiceoverAudio(runId, { metadataProvider: { ...provider, fetchSnapshot } }),
    ).rejects.toThrow(/requires explicit confirmation.*binding.*quote.*approval/i);

    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("blocks a stale hosted confirmation before metadata refresh or reservation", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const provider = successfulExecutionMetadataProvider({ subscription: paidVoiceSubscription });
    const fetchSnapshot = vi.fn(provider.fetchSnapshot.bind(provider));

    await expect(
      generateVoiceoverAudio(runId, {
        confirmation: {
          ...(await approvedHostedVoiceConfirmation(runId)),
          quoteDigest: "f".repeat(64),
        },
        metadataProvider: { ...provider, fetchSnapshot },
      }),
    ).rejects.toThrow(/confirmation is stale/i);

    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("accepts an exact hosted confirmation through live preflight without reserving cost", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const config = await loadConfig();
    const preparation = prepareVoiceoverText({
      runId,
      sourceText: await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8"),
      pronunciationReplacements: config.providers.tts.pronunciationReplacements,
    });

    await expect(
      prepareVoiceExecution({
        runId,
        config,
        preparedText: preparation.text,
        confirmation: await approvedHostedVoiceConfirmation(runId),
        metadataProvider: successfulExecutionMetadataProvider({
          subscription: paidVoiceSubscription,
        }),
      }),
    ).resolves.toMatchObject({
      provider: { mode: "elevenlabs", executionPolicy: "reserved-paid" },
      binding: { bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
      approvedQuote: {
        approvalId: expect.stringMatching(/^approval_/),
        quoteDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });

    expect(await readCostReservationSummaries(runId)).toEqual([]);
  });

  it("blocks live voice drift before reservation, synthesis, or audio persistence", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();

    await expect(
      generateVoiceoverAudio(runId, {
        confirmation: await approvedHostedVoiceConfirmation(runId),
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
    const confirmation = await approvedHostedVoiceConfirmation(runId);
    const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
      providers: { tts: { elevenLabs: Record<string, unknown> } };
    };
    config.providers.tts.elevenLabs.seed = 99;
    await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");

    await expect(
      generateVoiceoverAudio(runId, {
        confirmation,
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
});
