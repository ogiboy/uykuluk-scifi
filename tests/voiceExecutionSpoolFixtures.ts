import { readFile, writeFile } from "node:fs/promises";
import { expect } from "vitest";
import { loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import {
  costReservationLedgerPath,
  readCostReservationSummaries,
} from "../src/costs/costReservationStore";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import { splitElevenLabsText } from "../src/stages/voice/elevenLabsTextChunks";
import type { TtsSynthesisResult } from "../src/stages/voice/providers/ttsProvider";
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
import { successfulExecutionMetadataProvider } from "./voiceCatalogStageFixtures";
import { approvedQuote, reservedProvider } from "./voiceExecutionProviderFixtures";

export { reservedProvider } from "./voiceExecutionProviderFixtures";

export async function settledSpoolFixture() {
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
  const quoteApproval = await approvedQuote(runId);
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
      approvedQuote: quoteApproval,
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
    approvedQuote: quoteApproval,
    preparation,
    resultSpoolPath: first.paidExecution.resultSpool.path,
  };
}

export function synthesisResult(text: string): TtsSynthesisResult {
  const characters = Array.from(text);
  const normalizedCharacters = characters.map(() => "n");
  const chunks = splitElevenLabsText(text, 4_500);
  return {
    buffer: workflowFixtureWav(),
    alignment: {
      characters,
      characterStartTimesSeconds: characters.map((_, index) => index / characters.length),
      characterEndTimesSeconds: characters.map((_, index) => (index + 1) / characters.length),
    },
    normalizedAlignment: {
      characters: normalizedCharacters,
      characterStartTimesSeconds: normalizedCharacters.map(
        (_, index) => index / normalizedCharacters.length,
      ),
      characterEndTimesSeconds: normalizedCharacters.map(
        (_, index) => (index + 1) / normalizedCharacters.length,
      ),
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

export async function rewriteSettledSpoolAsLegacy(
  runId: string,
  resultSpoolPath: string,
): Promise<void> {
  const resultPath = artifactPath(runId, resultSpoolPath);
  const spool = JSON.parse(await readFile(resultPath, "utf8")) as Record<string, unknown> & {
    schemaVersion: number;
    spoolDigest: string;
    alignments: { original: { path: string; sha256: string; characterCount: number } };
  };
  const legacyAlignmentPath = spool.alignments.original.path.replace(
    /alignment\.original\.json$/,
    "alignment.json",
  );
  const originalAlignmentBytes = await readFile(
    artifactPath(runId, spool.alignments.original.path),
  );
  await writeFile(artifactPath(runId, legacyAlignmentPath), originalAlignmentBytes);
  const {
    spoolDigest: _currentDigest,
    schemaVersion: _currentVersion,
    alignments,
    ...sharedSpool
  } = spool;
  const legacyDigestInput = {
    ...sharedSpool,
    schemaVersion: 1,
    alignment: { ...alignments.original, path: legacyAlignmentPath },
  };
  const legacyDigest = canonicalVoiceEvidenceDigest(legacyDigestInput);
  await writeFile(
    resultPath,
    `${JSON.stringify({ ...legacyDigestInput, spoolDigest: legacyDigest }, null, 2)}\n`,
    "utf8",
  );
  const ledgerPath = costReservationLedgerPath(runId);
  const ledgerEvents = (await readFile(ledgerPath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .map((event) =>
      event.resultEvidenceDigest === undefined
        ? event
        : { ...event, resultEvidenceDigest: legacyDigest },
    );
  await writeFile(ledgerPath, `${ledgerEvents.map((event) => JSON.stringify(event)).join("\n")}\n`);
}
