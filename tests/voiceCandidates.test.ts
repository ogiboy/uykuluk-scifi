import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
} from "../src/stages/voice/catalog/voiceCatalogContracts";
import type { VoiceCatalogProvider } from "../src/stages/voice/catalog/voiceCatalogProvider";
import {
  readVoiceCandidates,
  readVoiceCandidatesWithPath,
} from "../src/stages/voice/catalog/voiceCatalogStore";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import {
  configureElevenLabs,
  preparePackagedRun,
  successfulCatalogProvider,
} from "./voiceCatalogStageFixtures";

describe("voice candidates stage", () => {
  useTempProject();

  it("persists a redacted run-scoped catalog without changing workflow state", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const provider = successfulCatalogProvider();

    const catalog = await generateVoiceCandidates(runId, { provider });

    expect(catalog).toMatchObject({
      schemaVersion: 1,
      runId,
      provider: "elevenlabs",
      catalogDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      candidates: [expect.objectContaining({ voiceId: "voice_catalog_test" })],
    });
    const current = await readVoiceCandidatesWithPath(runId);
    await expect(loadRun(runId)).resolves.toMatchObject({
      state: "PRODUCTION_PACKAGE_GENERATED",
      artifacts: expect.arrayContaining([current.path]),
    });
    const persisted = await readFile(artifactPath(runId, current.path), "utf8");
    expect(persisted).not.toContain("provider-request-id");
    expect(persisted).not.toContain("ELEVENLABS_API_KEY");
    await expect(readVoiceCandidates(runId)).resolves.toEqual(catalog);
  });

  it("records bounded redacted diagnostics when the provider fails", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    await generateVoiceCandidates(runId, { provider: successfulCatalogProvider() });
    const previous = await readVoiceCandidatesWithPath(runId);
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

    const failedRun = await loadRun(runId);
    const failurePath = failedRun.artifacts.filter(isVoiceCatalogFailureArtifactPath).at(-1);
    expect(failurePath).toBeDefined();
    const diagnostics = await readFile(artifactPath(runId, failurePath!), "utf8");
    expect(diagnostics).toContain('"code": "provider-unavailable"');
    expect(diagnostics).not.toContain("secret-token-value");
    await expect(loadRun(runId)).resolves.toMatchObject({
      state: "PRODUCTION_PACKAGE_GENERATED",
      artifacts: expect.arrayContaining([failurePath]),
    });
    expect(await pathExists(artifactPath(runId, previous.path))).toBe(true);
    await expect(readVoiceCandidates(runId)).rejects.toThrow("latest voice catalog refresh failed");
  });

  it("reloads run state after provider work and never overwrites a newer transition", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const baseProvider = successfulCatalogProvider();
    const racingProvider: VoiceCatalogProvider = {
      provider: "elevenlabs",
      assertReady() {},
      async fetchCatalog(input) {
        const current = await loadRun(runId);
        await saveRun({
          ...current,
          state: "COST_ESTIMATED",
          warnings: [...current.warnings, "concurrent-state-marker"],
        });
        return baseProvider.fetchCatalog(input);
      },
    };

    await expect(generateVoiceCandidates(runId, { provider: racingProvider })).rejects.toThrow(
      "requires state PRODUCTION_PACKAGE_GENERATED",
    );

    await expect(loadRun(runId)).resolves.toMatchObject({
      state: "COST_ESTIMATED",
      warnings: expect.arrayContaining(["concurrent-state-marker"]),
    });
    expect((await loadRun(runId)).artifacts.some(isVoiceCandidatesArtifactPath)).toBe(false);
  });

  it("preserves a newer catalog when an older concurrent request fails afterward", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const started = deferred<void>();
    const oldFailure = deferred<never>();
    const oldProvider: VoiceCatalogProvider = {
      provider: "elevenlabs",
      assertReady() {},
      async fetchCatalog() {
        started.resolve();
        return oldFailure.promise;
      },
    };

    const oldRequest = generateVoiceCandidates(runId, { provider: oldProvider });
    await started.promise;
    const newerCatalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider(),
    });
    oldFailure.reject(new Error("older-provider-failure-secret"));

    await expect(oldRequest).rejects.toThrow("could not be recorded safely");
    await expect(readVoiceCandidates(runId)).resolves.toEqual(newerCatalog);
    const current = await loadRun(runId);
    expect(current.artifacts.filter(isVoiceCandidatesArtifactPath)).toHaveLength(1);
    expect(current.artifacts.filter(isVoiceCatalogFailureArtifactPath)).toHaveLength(0);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
