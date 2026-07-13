import { readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import type { ReservedProviderAdapter } from "../src/costs/reservedProviderExecution";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import { splitElevenLabsText } from "../src/stages/voice/elevenLabsTextChunks";
import type {
  ReservedTtsProvider,
  TtsSynthesisResult,
} from "../src/stages/voice/providers/ttsProvider";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import { revalidateSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionPreflight";
import { synthesizeVoiceover } from "../src/stages/voice/voiceSynthesisExecution";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";
import { sha256 } from "../src/utils/hash";
import {
  paidVoiceSubscription,
  prepareApprovedSelectedVoiceRun,
  workflowFixtureWav,
} from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { successfulExecutionMetadataProvider } from "./voiceCatalogStageFixtures";

describe("voice execution result spool recovery", () => {
  useTempProject();

  it("reuses a settled operation spool without invoking the provider again", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const sourceText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");
    const preparation = prepareVoiceoverText({ runId, sourceText, pronunciationReplacements: {} });
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
    const quote = await readCostEstimate(runId);
    const approval = (await loadRun(runId)).approvals.find(
      (item) => item.target === "paid-generation-cost" && item.approvedRef === quote.digest,
    );
    if (!approval) throw new Error("Expected approved quote fixture.");
    const approvedQuote = { quoteDigest: quote.digest, approvalId: approval.approvalId };
    const firstExecute = vi.fn(async () => ({
      kind: "success" as const,
      value: synthesisResult(preparedText),
      actualUsdMicros: 1,
      providerRequestId: "provider-request-id",
    }));
    const first = await synthesizeVoiceover(
      reservedProvider(binding.bindingDigest, firstExecute),
      { runId, text: preparedText },
      {
        preparationDigest: binding.input.preparedTextDigest,
        binding,
        preflight,
        approvedQuote,
        preparation,
      },
    );
    if (!first.paidExecution) throw new Error("Expected paid execution evidence.");
    expect(first.paidExecution.resultSpool).toMatchObject({
      operationId: first.paidExecution.operationId,
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const retryExecute = vi.fn();
    const recovered = await synthesizeVoiceover(
      reservedProvider(binding.bindingDigest, retryExecute),
      { runId, text: preparedText },
      {
        preparationDigest: binding.input.preparedTextDigest,
        binding,
        preflight,
        approvedQuote,
        preparation,
      },
    );

    expect(firstExecute).toHaveBeenCalledTimes(1);
    expect(retryExecute).not.toHaveBeenCalled();
    expect(recovered.audio.buffer.equals(first.audio.buffer)).toBe(true);
    expect(recovered.paidExecution).toEqual(first.paidExecution);
  });

  it("rejects a self-rehashed settled spool without invoking the provider again", async () => {
    const fixture = await settledSpoolFixture();
    const resultPath = artifactPath(fixture.runId, fixture.resultSpoolPath);
    const spool = JSON.parse(await readFile(resultPath, "utf8")) as Record<string, unknown> & {
      createdAt: string;
      spoolDigest: string;
    };
    spool.createdAt = "2099-01-01T00:00:00.000Z";
    const { spoolDigest: _oldDigest, ...digestInput } = spool;
    spool.spoolDigest = canonicalVoiceEvidenceDigest(digestInput);
    await writeFile(resultPath, `${JSON.stringify(spool, null, 2)}\n`, "utf8");
    const retryExecute = vi.fn();

    await expect(
      synthesizeVoiceover(
        reservedProvider(fixture.binding.bindingDigest, retryExecute),
        { runId: fixture.runId, text: fixture.preparedText },
        {
          preparationDigest: fixture.binding.input.preparedTextDigest,
          binding: fixture.binding,
          preflight: fixture.preflight,
          approvedQuote: fixture.approvedQuote,
          preparation: fixture.preparation,
        },
      ),
    ).rejects.toThrow(/settlement|spool.*digest|result evidence/i);
    expect(retryExecute).not.toHaveBeenCalled();
  });

  it("rejects a missing settled spool without invoking the provider again", async () => {
    const fixture = await settledSpoolFixture();
    await rm(artifactPath(fixture.runId, fixture.resultSpoolPath));
    const retryExecute = vi.fn();

    await expect(
      synthesizeVoiceover(
        reservedProvider(fixture.binding.bindingDigest, retryExecute),
        { runId: fixture.runId, text: fixture.preparedText },
        {
          preparationDigest: fixture.binding.input.preparedTextDigest,
          binding: fixture.binding,
          preflight: fixture.preflight,
          approvedQuote: fixture.approvedQuote,
          preparation: fixture.preparation,
        },
      ),
    ).rejects.toThrow(/spool|no such file|missing/i);
    expect(retryExecute).not.toHaveBeenCalled();
  });
});

async function settledSpoolFixture() {
  const { runId } = await prepareApprovedSelectedVoiceRun();
  const sourceText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");
  const preparation = prepareVoiceoverText({ runId, sourceText, pronunciationReplacements: {} });
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
  const quote = await readCostEstimate(runId);
  const approval = (await loadRun(runId)).approvals.find(
    (item) => item.target === "paid-generation-cost" && item.approvedRef === quote.digest,
  );
  if (!approval) throw new Error("Expected approved quote fixture.");
  const approvedQuote = { quoteDigest: quote.digest, approvalId: approval.approvalId };
  const first = await synthesizeVoiceover(
    reservedProvider(binding.bindingDigest, async () => ({
      kind: "success",
      value: synthesisResult(preparedText),
      actualUsdMicros: 1,
      providerRequestId: "provider-request-id",
    })),
    { runId, text: preparedText },
    {
      preparationDigest: binding.input.preparedTextDigest,
      binding,
      preflight,
      approvedQuote,
      preparation,
    },
  );
  if (!first.paidExecution) throw new Error("Expected paid execution evidence.");
  const reservation = (await readCostReservationSummaries(runId)).find(
    (item) => item.reservationId === first.paidExecution?.reservationId,
  );
  expect(reservation).toMatchObject({
    status: "SETTLED",
    resultEvidenceDigest: first.paidExecution.resultSpool.digest,
  });
  return {
    runId,
    preparedText,
    binding,
    preflight,
    approvedQuote,
    preparation,
    resultSpoolPath: first.paidExecution.resultSpool.path,
  };
}

function reservedProvider(
  bindingDigest: string,
  execute: ReservedProviderAdapter<TtsSynthesisResult>["execute"],
): ReservedTtsProvider {
  return {
    mode: "elevenlabs",
    executionPolicy: "reserved-paid",
    assertReady() {},
    createReservedAdapter: () => ({
      provider: "elevenlabs",
      model: "eleven_v3",
      bindingDigest,
      execute,
    }),
  };
}

function synthesisResult(text: string): TtsSynthesisResult {
  const characters = Array.from(text);
  const chunks = splitElevenLabsText(text, 4_500);
  return {
    buffer: workflowFixtureWav(),
    alignment: {
      characters,
      characterStartTimesSeconds: characters.map((_, index) => index / characters.length),
      characterEndTimesSeconds: characters.map((_, index) => (index + 1) / characters.length),
    },
    channels: 1,
    durationSeconds: 1,
    outputAlreadyPersisted: false,
    provider: {
      service: "elevenlabs",
      modelId: "eleven_v3",
      voiceId: "voice_catalog_test",
      outputFormat: "wav_24000",
    },
    providerBilling: {
      source: "provider-reported-credits-approved-tariff-derived-usd",
      billableCredits: 1,
      baseUsdPerThousandBillableCredits: 0.001,
      derivedUsdMicros: 1,
    },
    providerRequests: chunks.map((chunk, index) => ({
      chunkIndex: index,
      textDigest: sha256(chunk),
      reportedBillableCredits: index === 0 ? 1 : 0,
    })),
    quality: "elevenlabs",
    sampleRateHz: 24_000,
  };
}
