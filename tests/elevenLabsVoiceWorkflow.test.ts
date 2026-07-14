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
  approvedHostedVoiceConfirmation,
  configureWorkflowElevenLabs,
  paidVoiceSubscription,
  preparePackagedWorkflowRun,
  setConfiguredCandidateVoiceId,
  workflowConvertWithTimestamps,
} from "./elevenLabsVoiceWorkflowFixtures";
import { verifyWorkflowEvidenceTamperGuards } from "./elevenLabsVoiceWorkflowTamperAssertions";
import { useTempProject } from "./helpers";
import { prepareApprovedStaticVisuals } from "./visualTestHelpers";
import {
  successfulCatalogProvider,
  successfulExecutionMetadataProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("ElevenLabs voice workflow", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-workflow-test-key";
    sdk.convertWithTimestamps.mockImplementation(workflowConvertWithTimestamps);
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
    await prepareApprovedStaticVisuals(runId);
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
      confirmation: await approvedHostedVoiceConfirmation(runId),
      metadataProvider: successfulExecutionMetadataProvider({
        subscription: paidVoiceSubscription,
      }),
    });
    expect(meta).toMatchObject({
      schemaVersion: 2,
      mode: "elevenlabs",
      quality: "elevenlabs",
      alignment: {
        path: "production/audio/alignment.json",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      normalizedAlignment: {
        path: "production/audio/alignment.normalized.json",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      subtitle: {
        timingMode: "elevenlabs-character-aligned",
        path: "production/audio/subtitles.aligned.srt",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        metadataPath: "production/audio/subtitles.aligned.meta.json",
        metadataSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
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
      normalizedAlignmentPath: "production/audio/alignment.normalized.json",
      productionVoiceCandidate: true,
      subtitle: {
        timingMode: "elevenlabs-character-aligned",
        path: "production/audio/subtitles.aligned.srt",
        metadataPath: "production/audio/subtitles.aligned.meta.json",
      },
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
        "production/audio/alignment.normalized.json",
        "production/audio/subtitles.aligned.srt",
        "production/audio/subtitles.aligned.meta.json",
        "costs/ledger.jsonl",
      ].map((relativePath) => readFile(artifactPath(runId, relativePath), "utf8")),
    );
    expect(persisted.join("\n")).not.toContain("secret-workflow-test-key");
    expect(persisted[1]).toContain("Execution binding");
    expect(persisted[1]).toContain("Selection digest");
    expect(persisted[1]).toContain("Reservation ID");
    expect(persisted[1]).toContain("elevenlabs-character-aligned");
    const subtitleMetadata = JSON.parse(persisted[5]) as {
      timingMode: string;
      alignment?: { authority: string };
      output: { path: string; cueCount: number };
    };
    expect(subtitleMetadata).toMatchObject({
      timingMode: "elevenlabs-character-aligned",
      alignment: { authority: "elevenlabs-original" },
      output: { path: "production/audio/subtitles.aligned.srt", cueCount: expect.any(Number) },
    });
    const quoteMarkdown = await readFile(artifactPath(runId, "costs/estimate.md"), "utf8");
    expect(quoteMarkdown).toContain(
      `Selection digest: \`${currentSelection.selection.selectionDigest}\``,
    );
    expect(quoteMarkdown).toContain(`Voice ID: \`${selectedVoiceId}\``);
    expect(quoteMarkdown).toContain("Approved maximum rate: 0.001000 USD / 1K characters");

    await verifyWorkflowEvidenceTamperGuards({
      runId,
      run,
      originalMetaText: persisted[0],
      originalAlignmentText: persisted[2],
      originalSubtitleText: persisted[4],
      originalSubtitleMetadataText: persisted[5],
    });
  });
});
