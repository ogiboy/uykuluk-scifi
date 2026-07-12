import { readFile, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ convertWithTimestamps: vi.fn() }));

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    readonly textToSpeech = { convertWithTimestamps: sdk.convertWithTimestamps };
  },
}));

import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { readCostEvents } from "../src/costs/costLedger";
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
import { generateVoiceoverAudio } from "../src/stages/voice";
import { readVoiceoverAudioEvidence } from "../src/stages/voice/voiceoverEvidence";
import { wavFromPcm16 } from "../src/stages/voice/voiceWav";
import { useTempProject } from "./helpers";
import { createMinimalRenderAssets } from "./renderTestHelpers";

describe("ElevenLabs voice workflow", () => {
  useTempProject();

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "secret-workflow-test-key";
    sdk.convertWithTimestamps.mockImplementation((_voiceId, request) => {
      const characters = Array.from(request.text as string);
      return {
        withRawResponse: async () => ({
          data: {
            audioBase64: fixtureWav().toString("base64"),
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
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    await generateRenderPlan(runId);
    await estimateCost(runId);

    const quote = (await readCostEstimate(runId)).estimate;
    expect(quote.stages.find((stage) => stage.stage === "tts")).toMatchObject({
      provider: "elevenlabs",
      model: "eleven_v3",
      enabled: true,
      estimatedUsd: expect.any(Number),
    });
    expect(quote.approvalRequired).toBe(true);

    await approvePaidGenerationCost(runId);
    await generateEvidenceBundle(runId);
    expect((await runReadiness(runId)).passed).toBe(true);

    const meta = await generateVoiceoverAudio(runId);
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
        voiceId: "voice_workflow_test",
        outputFormat: "wav_24000",
      },
    });
    const run = await loadRun(runId);
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "pass",
      alignmentPath: "production/audio/alignment.json",
      productionVoiceCandidate: true,
    });
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

    const persisted = await Promise.all(
      [
        "production/audio/voiceover.meta.json",
        "production/audio/voiceover_review.md",
        "production/audio/alignment.json",
        "costs/ledger.jsonl",
      ].map((relativePath) => readFile(artifactPath(runId, relativePath), "utf8")),
    );
    expect(persisted.join("\n")).not.toContain("secret-workflow-test-key");

    await writeFile(
      artifactPath(runId, "production/audio/alignment.json"),
      '{"characters":["tampered"]}\n',
      "utf8",
    );
    await expect(readVoiceoverAudioEvidence(run)).resolves.toMatchObject({
      status: "block",
      message: expect.stringContaining("alignment digest"),
    });
  });
});

async function configureElevenLabs(): Promise<void> {
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
              voiceId: "voice_workflow_test",
              modelId: "eleven_v3",
              outputFormat: "wav_24000",
              timeoutMs: 30_000,
              maxRetries: 0,
              usdPerThousandCharacters: 0.001,
            },
          },
        },
        budgets: {
          perVideoUsd: 0.5,
          dailyUsd: 1,
          weeklyUsd: 5,
          requireApprovalAboveUsd: 0.000_001,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function preparePackagedRun(): Promise<string> {
  await createMinimalRenderAssets();
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}

function fixtureWav(): Buffer {
  const pcm = Buffer.alloc(24_000 * 2);
  for (let index = 0; index < 24_000; index += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * index) / 24_000) * 2_000), index * 2);
  }
  return wavFromPcm16(pcm, 24_000, 1);
}
