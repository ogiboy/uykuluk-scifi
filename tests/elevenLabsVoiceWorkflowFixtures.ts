import { readFile, writeFile } from "node:fs/promises";

import { defaultConfig } from "../src/config/config";
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

export async function setConfiguredCandidateVoiceId(voiceId: string): Promise<void> {
  const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
    providers: { tts: { elevenLabs: Record<string, unknown> } };
  };
  config.providers.tts.elevenLabs.voiceId = voiceId;
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

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

export function workflowFixtureWav(): Buffer {
  const pcm = Buffer.alloc(24_000 * 2);
  for (let index = 0; index < 24_000; index += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * index) / 24_000) * 2_000), index * 2);
  }
  return wavFromPcm16(pcm, 24_000, 1);
}
