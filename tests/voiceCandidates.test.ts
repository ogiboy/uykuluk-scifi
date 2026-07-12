import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { normalizeVoiceCatalog } from "../src/stages/voice/catalog/voiceCatalogNormalization";
import type { VoiceCatalogProvider } from "../src/stages/voice/catalog/voiceCatalogProvider";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { useTempProject } from "./helpers";

describe("voice candidates stage", () => {
  useTempProject();

  it("persists a redacted run-scoped catalog without changing workflow state", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const provider = successfulProvider();

    const catalog = await generateVoiceCandidates(runId, { provider });

    expect(catalog).toMatchObject({
      schemaVersion: 1,
      runId,
      provider: "elevenlabs",
      catalogDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      candidates: [expect.objectContaining({ voiceId: "voice_catalog_test" })],
    });
    await expect(loadRun(runId)).resolves.toMatchObject({
      state: "PRODUCTION_PACKAGE_GENERATED",
      artifacts: expect.arrayContaining(["production/audio/voice_candidates.json"]),
    });
    const persisted = await readFile(
      artifactPath(runId, "production/audio/voice_candidates.json"),
      "utf8",
    );
    expect(persisted).not.toContain("provider-request-id");
    expect(persisted).not.toContain("ELEVENLABS_API_KEY");
  });

  it("records bounded redacted diagnostics when the provider fails", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const provider: VoiceCatalogProvider = {
      provider: "elevenlabs",
      assertReady() {},
      async fetchCatalog() {
        throw new Error("provider response leaked secret-token-value");
      },
    };

    await expect(generateVoiceCandidates(runId, { provider })).rejects.toThrow(
      "could not be recorded safely",
    );

    const diagnostics = await readFile(
      artifactPath(runId, "diagnostics/voice_catalog_failure.json"),
      "utf8",
    );
    expect(diagnostics).toContain('"code": "provider-unavailable"');
    expect(diagnostics).not.toContain("secret-token-value");
    await expect(loadRun(runId)).resolves.toMatchObject({
      state: "PRODUCTION_PACKAGE_GENERATED",
      artifacts: expect.arrayContaining(["diagnostics/voice_catalog_failure.json"]),
    });
  });
});

function successfulProvider(): VoiceCatalogProvider {
  return {
    provider: "elevenlabs",
    assertReady() {},
    async fetchCatalog(input) {
      return normalizeVoiceCatalog({
        request: input,
        requestIds: ["provider-request-id"],
        models: [
          {
            modelId: "eleven_v3",
            canDoTextToSpeech: true,
            canUseStyle: true,
            canUseSpeakerBoost: false,
            maximumTextLengthPerRequest: 5_000,
            languages: [{ languageId: "tr" }],
            modelRates: { characterCostMultiplier: 1, costDiscountMultiplier: 1 },
          },
        ],
        subscription: {
          tier: "free",
          status: "active",
          characterCount: 0,
          characterLimit: 10_000,
          hasOpenInvoices: false,
        },
        voices: [
          {
            voiceId: "voice_catalog_test",
            name: "Catalog Test Voice",
            category: "premade",
            previewUrl:
              "https://storage.googleapis.com/eleven-public-prod/catalog-test.mp3?token=redacted",
            verifiedLanguages: [
              {
                language: "tr",
                modelId: "eleven_v3",
                previewUrl: "https://storage.googleapis.com/eleven-public-prod/catalog-test-tr.mp3",
              },
            ],
          },
        ],
      });
    },
  };
}

async function configureElevenLabs(): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify(
      {
        ...defaultConfig,
        providers: {
          ...defaultConfig.providers,
          tts: { ...defaultConfig.providers.tts, enabled: true, mode: "elevenlabs" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function preparePackagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}
