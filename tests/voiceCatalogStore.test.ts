import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { type VoiceCandidates } from "../src/stages/voice/catalog/voiceCatalogContracts";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import {
  readVoiceCandidates,
  readVoiceCandidatesWithPath,
} from "../src/stages/voice/catalog/voiceCatalogStore";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { useTempProject } from "./helpers";
import {
  configureElevenLabs,
  preparePackagedRun,
  successfulCatalogProvider,
} from "./voiceCatalogStageFixtures";

describe("voice catalog evidence store", () => {
  useTempProject();

  it("verifies canonical digests independently of persisted object key order", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const catalog = await generateVoiceCandidates(runId, { provider: successfulCatalogProvider() });
    const current = await readVoiceCandidatesWithPath(runId);
    const target = artifactPath(runId, current.path);
    await writeFile(target, `${JSON.stringify(reverseKeys(catalog), null, 2)}\n`, "utf8");

    await expect(readVoiceCandidates(runId)).resolves.toEqual(catalog);
  });

  it.each(["candidate", "model", "subscription", "pricing"] as const)(
    "rejects a recomputed outer digest when the nested %s digest is stale",
    async (targetKind) => {
      await configureElevenLabs();
      const runId = await preparePackagedRun();
      await generateVoiceCandidates(runId, { provider: successfulCatalogProvider() });
      const current = await readVoiceCandidatesWithPath(runId);
      const target = artifactPath(runId, current.path);
      const catalog = JSON.parse(await readFile(target, "utf8")) as VoiceCandidates;
      if (targetKind === "candidate") catalog.candidates[0].name = "Tampered candidate";
      if (targetKind === "model") catalog.model.name = "Tampered model";
      if (targetKind === "subscription") catalog.subscription.status = "past_due";
      if (targetKind === "pricing") {
        catalog.pricing.characterCostMultiplier = 2;
        catalog.pricing.effectiveUsdPerThousandCharacters =
          catalog.pricing.baseUsdPerThousandCharacters *
          catalog.pricing.characterCostMultiplier *
          catalog.pricing.costDiscountMultiplier;
        catalog.pricing.maximumUsdPerThousandCharacters =
          catalog.pricing.baseUsdPerThousandCharacters *
          catalog.pricing.characterCostMultiplier *
          Math.max(1, catalog.pricing.costDiscountMultiplier);
      }
      const { catalogDigest: _ignored, ...unsigned } = catalog;
      catalog.catalogDigest = canonicalVoiceEvidenceDigest(unsigned);
      await writeFile(target, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

      await expect(readVoiceCandidates(runId)).rejects.toThrow(
        new RegExp(`${targetKind}.*digest`, "i"),
      );
    },
  );

  it("rejects a valid catalog file when its path is no longer registered in run state", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    await generateVoiceCandidates(runId, { provider: successfulCatalogProvider() });
    const current = await readVoiceCandidatesWithPath(runId);
    const run = await loadRun(runId);
    await saveRun({
      ...run,
      artifacts: run.artifacts.filter((relativePath) => relativePath !== current.path),
    });

    await expect(readVoiceCandidates(runId)).rejects.toThrow("No current voice candidate catalog");
    await expect(readFile(artifactPath(runId, current.path), "utf8")).resolves.toContain(
      '"provider": "elevenlabs"',
    );
  });
});

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, item]) => [key, reverseKeys(item)]),
    );
  }
  return value;
}
