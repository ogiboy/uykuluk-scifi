import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: sdk.convertWithTimestamps };
  },
}));

import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { readCostEvents } from "../src/costs/costLedger";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { generateVoiceoverAudio } from "../src/stages/voice";
import { readCurrentVoiceSelection } from "../src/stages/voice/catalog/voiceSelectionStore";
import { readVoiceoverAudioEvidence } from "../src/stages/voice/voiceoverEvidence";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { sha256 } from "../src/utils/hash";
import {
  configureWorkflowElevenLabs,
  paidVoiceSubscription,
  preparePackagedWorkflowRun,
  setConfiguredCandidateVoiceId,
  workflowFixtureWav,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import {
  successfulCatalogProvider,
  successfulExecutionMetadataProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("ElevenLabs voice workflow", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-workflow-test-key";
    sdk.convertWithTimestamps.mockImplementation((_voiceId, request) => {
      const characters = Array.from(request.text as string);
      return {
        withRawResponse: async () => ({
          data: {
            audioBase64: workflowFixtureWav().toString("base64"),
            alignment: {
              characters,
              characterStartTimesSeconds: characters.map(
                (_, index) => (index / characters.length) * 0.9,
              ),
              characterEndTimesSeconds: characters.map(
                (_, index) => ((index + 1) / characters.length) * 0.9,
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

  it("quotes, reserves, synthesizes, and persists redacted production voice evidence", async () => {
    await configureWorkflowElevenLabs();
    const runId = await preparePackagedWorkflowRun();
    const catalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({ subscription: paidVoiceSubscription }),
    });
    const selectedVoiceId = catalog.candidates[0].voiceId;
    await generateVoicePreview(runId, selectedVoiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    await selectVoice(runId, {
      voiceId: selectedVoiceId,
      reviewedBy: "workflow operator",
      notes: "approved mocked production voice",
      confirmProductionRights: true,
    });
    const currentSelection = await readCurrentVoiceSelection(runId);
    await generateRenderPlan(runId);
    await estimateCost(runId);

    const quote = (await readCostEstimate(runId)).estimate;
    expect(quote.stages.find((stage) => stage.stage === "tts")).toMatchObject({
      provider: "elevenlabs",
      model: "eleven_v3",
      bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      bindingSummary: {
        kind: "selected-voice",
        selectionDigest: currentSelection.selection.selectionDigest,
        voiceId: selectedVoiceId,
        modelId: "eleven_v3",
        expectedUsdPerThousandCharacters: 0.001,
        maximumUsdPerThousandCharacters: 0.001,
      },
      enabled: true,
      estimatedUsd: expect.any(Number),
    });
    expect(quote.approvalRequired).toBe(true);

    await approvePaidGenerationCost(runId);
    await setConfiguredCandidateVoiceId("different_config_hint_after_approval");
    await generateEvidenceBundle(runId);
    expect((await runReadiness(runId)).passed).toBe(true);

    const meta = await generateVoiceoverAudio(runId, {
      metadataProvider: successfulExecutionMetadataProvider({
        subscription: paidVoiceSubscription,
      }),
    });
    expect(meta).toMatchObject({
      mode: "elevenlabs",
      quality: "elevenlabs",
      alignment: {
        path: "production/audio/alignment.json",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      provider: {
        service: "elevenlabs",
        modelId: "eleven_v3",
        voiceId: selectedVoiceId,
        outputFormat: "wav_24000",
      },
      paidExecution: {
        bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        binding: {
          bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
          voice: { voiceId: selectedVoiceId },
          model: { modelId: "eleven_v3" },
        },
        selection: {
          path: currentSelection.selectionPath,
          digest: currentSelection.selection.selectionDigest,
        },
        operationId: expect.stringMatching(/^tts_[a-f0-9]{64}$/),
        reservationId: expect.stringMatching(/^reservation_/),
      },
    });
    const run = await loadRun(runId);
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "pass",
      alignmentPath: "production/audio/alignment.json",
      productionVoiceCandidate: true,
    });

    const changedConfig = JSON.parse(await readFile("producer.config.json", "utf8")) as {
      providers: { tts: { elevenLabs: Record<string, unknown> } };
    };
    changedConfig.providers.tts.elevenLabs.seed = 99;
    await writeFile("producer.config.json", `${JSON.stringify(changedConfig, null, 2)}\n`, "utf8");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1_000);
      await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({ status: "pass" });
    } finally {
      vi.useRealTimers();
    }

    expect(await readCostEvents(runId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "elevenlabs",
          stage: "tts",
          actualUsd: expect.any(Number),
        }),
      ]),
    );
    expect(sdk.convertWithTimestamps).toHaveBeenCalledTimes(2);
    expect(new Set(sdk.convertWithTimestamps.mock.calls.map(([voiceId]) => voiceId))).toEqual(
      new Set([selectedVoiceId]),
    );
    expect(await readCostReservationSummaries(runId)).toContainEqual(
      expect.objectContaining({
        bindingDigest: quote.stages.find((stage) => stage.stage === "tts")?.bindingDigest,
        bindingSummary: expect.objectContaining({
          selectionDigest: currentSelection.selection.selectionDigest,
          voiceId: selectedVoiceId,
          modelId: "eleven_v3",
        }),
        status: "SETTLED",
      }),
    );
    if (!meta.paidExecution) throw new Error("Expected paid execution evidence.");
    const spoolText = await readFile(
      artifactPath(runId, meta.paidExecution.resultSpool.path),
      "utf8",
    );
    const spool = JSON.parse(spoolText) as {
      result: { providerRequests: Array<{ requestIdHash?: string; textDigest: string }> };
    };
    expect(spool.result.providerRequests).toHaveLength(2);
    expect(spool.result.providerRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestIdHash: sha256("workflow-request-id"),
          textDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ]),
    );
    expect(spoolText).not.toContain("workflow-request-id");

    const persisted = await Promise.all(
      [
        "production/audio/voiceover.meta.json",
        "production/audio/voiceover_review.md",
        "production/audio/alignment.json",
        "costs/ledger.jsonl",
      ].map((relativePath) => readFile(artifactPath(runId, relativePath), "utf8")),
    );
    expect(persisted.join("\n")).not.toContain("secret-workflow-test-key");
    expect(persisted[1]).toContain("Execution binding");
    expect(persisted[1]).toContain("Selection digest");
    expect(persisted[1]).toContain("Reservation ID");
    const quoteMarkdown = await readFile(artifactPath(runId, "costs/estimate.md"), "utf8");
    expect(quoteMarkdown).toContain(
      `Selection digest: \`${currentSelection.selection.selectionDigest}\``,
    );
    expect(quoteMarkdown).toContain(`Voice ID: \`${selectedVoiceId}\``);
    expect(quoteMarkdown).toContain("Approved maximum rate: 0.001000 USD / 1K characters");

    const metaPath = artifactPath(runId, "production/audio/voiceover.meta.json");
    const originalMetaText = await readFile(metaPath, "utf8");
    const tamperedMeta = JSON.parse(originalMetaText) as { paidExecution: { approvalId: string } };
    tamperedMeta.paidExecution.approvalId = "approval_forged";
    await writeFile(metaPath, `${JSON.stringify(tamperedMeta, null, 2)}\n`, "utf8");
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringMatching(/paid execution.*approval|approval.*reservation/i),
    });
    await writeFile(metaPath, originalMetaText, "utf8");

    const tamperedBindingMeta = JSON.parse(originalMetaText) as {
      paidExecution: { binding: { voice: { voiceId: string } } };
    };
    tamperedBindingMeta.paidExecution.binding.voice.voiceId = "forged_voice";
    await writeFile(metaPath, `${JSON.stringify(tamperedBindingMeta, null, 2)}\n`, "utf8");
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringMatching(/binding digest|pinned voice binding|selection artifact/i),
    });
    await writeFile(metaPath, originalMetaText, "utf8");

    const costLedgerPath = artifactPath(runId, "costs/ledger.jsonl");
    const originalCostLedger = await readFile(costLedgerPath, "utf8");
    await writeFile(costLedgerPath, "", "utf8");
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringMatching(/reservation-linked cost event|cost event/i),
    });
    await writeFile(costLedgerPath, originalCostLedger, "utf8");

    await writeFile(
      artifactPath(runId, "production/audio/alignment.json"),
      '{"characters":["tampered"]}\n',
      "utf8",
    );
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringContaining("alignment digest"),
    });

    const originalAlignmentText = persisted[2];
    const tamperedAlignment = JSON.parse(originalAlignmentText) as {
      characters: string[];
      characterStartTimesSeconds: number[];
      characterEndTimesSeconds: number[];
    };
    tamperedAlignment.characterStartTimesSeconds[0] += 0.001;
    const tamperedAlignmentText = `${JSON.stringify(tamperedAlignment, null, 2)}\n`;
    await writeFile(
      artifactPath(runId, "production/audio/alignment.json"),
      tamperedAlignmentText,
      "utf8",
    );
    const alignmentRehashedMeta = JSON.parse(originalMetaText) as { alignment: { sha256: string } };
    alignmentRehashedMeta.alignment.sha256 = sha256(tamperedAlignmentText);
    await writeFile(metaPath, `${JSON.stringify(alignmentRehashedMeta, null, 2)}\n`, "utf8");
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringMatching(/provider spool.*alignment|alignment.*spool/i),
    });
  });

  it("recovers a settled provider result after a crash before final artifact persistence", async () => {
    await configureWorkflowElevenLabs();
    const runId = await preparePackagedWorkflowRun();
    const catalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({ subscription: paidVoiceSubscription }),
    });
    const voiceId = catalog.candidates[0].voiceId;
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "recovery operator",
      notes: "settled spool recovery fixture",
      confirmProductionRights: true,
    });
    await generateRenderPlan(runId);
    await estimateCost(runId);
    await approvePaidGenerationCost(runId);
    await generateEvidenceBundle(runId);
    expect((await runReadiness(runId)).passed).toBe(true);
    const metadataProvider = successfulExecutionMetadataProvider({
      subscription: paidVoiceSubscription,
    });

    await expect(
      generateVoiceoverAudio(runId, {
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
    await configureWorkflowElevenLabs();
    const runId = await preparePackagedWorkflowRun();
    const catalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({ subscription: paidVoiceSubscription }),
    });
    const voiceId = catalog.candidates[0].voiceId;
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "settlement recovery operator",
      notes: "committed result recovery fixture",
      confirmProductionRights: true,
    });
    await generateRenderPlan(runId);
    await estimateCost(runId);
    await approvePaidGenerationCost(runId);
    await generateEvidenceBundle(runId);
    expect((await runReadiness(runId)).passed).toBe(true);

    await expect(
      generateVoiceoverAudio(runId, {
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
