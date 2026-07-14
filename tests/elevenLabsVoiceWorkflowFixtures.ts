import { readFile, writeFile } from "node:fs/promises";

import { defaultConfig, loadConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { approvePaidGenerationCost } from "../src/stages/approveCost";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { generateRenderPlan } from "../src/stages/renderPlan";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { buildSelectedVoiceExecutionBinding } from "../src/stages/voice/voiceExecutionBinding";
import type { HostedVoiceExecutionConfirmation } from "../src/stages/voice/voiceExecutionConfirmation";
import { prepareVoiceoverText } from "../src/stages/voice/voiceoverPreparation";
import { wavFromPcm16 } from "../src/stages/voice/voiceWav";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { createMinimalRenderAssets } from "./renderTestHelpers";
import { successfulCatalogProvider, successfulPreviewProvider } from "./voiceCatalogStageFixtures";

export const paidVoiceSubscription = {
  tier: "creator",
  status: "active",
  characterCount: 1_000,
  characterLimit: 100_000,
  hasOpenInvoices: false,
};

/**
 * Configures the workflow to use the ElevenLabs text-to-speech provider and writes the configuration to `producer.config.json`.
 */
export async function configureWorkflowElevenLabs(): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: {
            enabled: true,
            mode: "elevenlabs",
            pronunciationReplacements: { JWST: "James Webb Uzay Teleskobu" },
            elevenLabs: {
              voiceId: "config_candidate_not_selected",
              modelId: "eleven_v3",
              outputFormat: "wav_24000",
              timeoutMs: 30_000,
              maxRetries: 0,
              usdPerThousandCharacters: 0.001,
            },
          },
        },
        budgets: { perVideoUsd: 0.5, dailyUsd: 1, weeklyUsd: 5, requireApprovalAboveUsd: 0.000001 },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

/**
 * Updates the configured ElevenLabs voice used by the workflow.
 *
 * @param voiceId - The identifier of the voice to configure
 */
export async function setConfiguredCandidateVoiceId(voiceId: string): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: { elevenLabs: Record<string, unknown> } };
  };
  config.providers.tts.elevenLabs.voiceId = voiceId;
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Prepares a workflow run through production package generation.
 *
 * @returns The identifier of the prepared workflow run.
 */
export async function preparePackagedWorkflowRun(): Promise<string> {
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}

/**
 * Prepares a workflow run with an approved voice and verifies that it reaches readiness.
 *
 * @returns The generated voice catalog, workflow run identifier, and selected voice identifier.
 */
export async function prepareApprovedSelectedVoiceRun() {
  await configureWorkflowElevenLabs();
  const runId = await preparePackagedWorkflowRun();
  const catalog = await generateVoiceCandidates(runId, {
    provider: successfulCatalogProvider({ subscription: paidVoiceSubscription }),
  });
  const voiceId = catalog.candidates[0].voiceId;
  await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
  await selectVoice(runId, {
    voiceId,
    reviewedBy: "workflow fixture operator",
    notes: "approved selected voice fixture",
    confirmProductionRights: true,
  });
  await generateRenderPlan(runId);
  await estimateCost(runId);
  await approvePaidGenerationCost(runId);
  await generateEvidenceBundle(runId);
  if (!(await runReadiness(runId)).passed) {
    throw new Error("Approved selected voice fixture did not reach readiness.");
  }
  return { catalog, runId, voiceId };
}

/** Builds the exact confirmation currently required by an approved ElevenLabs workflow fixture. */
export async function approvedHostedVoiceConfirmation(
  runId: string,
): Promise<HostedVoiceExecutionConfirmation> {
  const config = await loadConfig();
  const sourceText = await readFile(artifactPath(runId, "production/voiceover.txt"), "utf8");
  const preparation = prepareVoiceoverText({
    runId,
    sourceText,
    pronunciationReplacements: config.providers.tts.pronunciationReplacements,
  });
  const binding = await buildSelectedVoiceExecutionBinding({
    runId,
    config,
    preparedText: preparation.text,
  });
  const quoteDigest = (await readCostEstimate(runId)).digest;
  const approval = (await loadRun(runId)).approvals.find(
    (item) => item.target === "paid-generation-cost" && item.approvedRef === quoteDigest,
  );
  if (!approval) throw new Error("Expected exact paid-generation approval fixture.");
  return {
    approvalId: approval.approvalId,
    bindingDigest: binding.bindingDigest,
    confirmPaidOperation: true,
    quoteDigest,
  };
}

/**
 * Generates a duration-aware 24 kHz mono silent WAV fixture.
 *
 * @param durationSeconds - Whole-second duration used by mocked alignment timelines
 * @returns A WAV audio buffer containing duration-accurate silence.
 */
export function workflowFixtureWav(durationSeconds = 1): Buffer {
  const pcm = Buffer.alloc(24_000 * durationSeconds * 2);
  return wavFromPcm16(pcm, 24_000, 1);
}

export function workflowConvertWithTimestamps(_voiceId: unknown, request: { text: unknown }) {
  const characters = Array.from(request.text as string);
  const durationSeconds = Math.max(1, characters.length / 14);
  return {
    withRawResponse: async () => ({
      data: {
        audioBase64: workflowFixtureWav(Math.ceil(durationSeconds)).toString("base64"),
        alignment: workflowAlignment(characters, durationSeconds),
        normalizedAlignment: workflowAlignment(characters, durationSeconds),
      },
      rawResponse: {
        headers: new Headers({
          "character-cost": String(characters.length),
          "request-id": "workflow-request-id",
        }),
      },
    }),
  };
}

function workflowAlignment(characters: string[], durationSeconds: number) {
  return {
    characters,
    characterStartTimesSeconds: characters.map(
      (_, index) => (index / characters.length) * durationSeconds,
    ),
    characterEndTimesSeconds: characters.map(
      (_, index) => ((index + 1) / characters.length) * durationSeconds,
    ),
  };
}
