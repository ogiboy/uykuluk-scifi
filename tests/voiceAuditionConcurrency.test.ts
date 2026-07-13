import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import {
  isVoicePreviewFailureArtifactPath,
  voicePreviewDirectory,
} from "../src/stages/voice/catalog/voiceAuditionContracts";
import type { VoicePreviewProvider } from "../src/stages/voice/catalog/voiceCatalogProvider";
import { readVoicePreviewEvidence } from "../src/stages/voice/catalog/voiceCatalogStore";
import { readVoiceSelection } from "../src/stages/voice/catalog/voiceSelectionStore";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { useTempProject } from "./helpers";
import { candidateVoiceId, deferred, prepareVoiceCatalog } from "./voiceAuditionStageFixtures";
import { successfulPreviewProvider } from "./voiceCatalogStageFixtures";

describe("voice audition concurrency", () => {
  useTempProject();

  it("preserves a newer preview when an older concurrent request fails afterward", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const started = deferred<void>();
    const oldFailure = deferred<never>();
    const oldProvider: VoicePreviewProvider = {
      provider: "elevenlabs",
      assertReady() {},
      async fetchPreview() {
        started.resolve();
        return oldFailure.promise;
      },
    };

    const oldRequest = generateVoicePreview(runId, voiceId, { provider: oldProvider });
    await started.promise;
    const newer = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    oldFailure.reject(new Error("older-preview-failure-secret"));

    await expect(oldRequest).rejects.toThrow("could not be recorded safely");
    await expect(readVoicePreviewEvidence(runId, voiceId)).resolves.toEqual(newer);
    const current = await loadRun(runId);
    expect(
      current.artifacts.filter((relativePath) =>
        isVoicePreviewFailureArtifactPath(relativePath, voiceId),
      ),
    ).toHaveLength(0);
    const failureFiles = await readdir(
      artifactPath(runId, `diagnostics/voice-preview-failures/${voiceId}`),
    );
    expect(failureFiles.filter((file) => file.endsWith(".json"))).toHaveLength(0);
  });

  it("removes preview files when an older successful request loses the finalization race", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const started = deferred<void>();
    const release = deferred<Awaited<ReturnType<VoicePreviewProvider["fetchPreview"]>>>();
    const olderProvider: VoicePreviewProvider = {
      provider: "elevenlabs",
      assertReady() {},
      async fetchPreview() {
        started.resolve();
        return release.promise;
      },
    };

    const olderRequest = generateVoicePreview(runId, voiceId, { provider: olderProvider });
    await started.promise;
    const newer = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    release.resolve(
      await successfulPreviewProvider(catalog).fetchPreview({
        candidate: catalog.candidates[0],
        languageCode: "tr",
        modelId: catalog.model.modelId,
        subscription: {
          tier: catalog.subscription.tier,
          status: catalog.subscription.status,
          hasOpenInvoices: catalog.subscription.hasOpenInvoices,
        },
      }),
    );

    await expect(olderRequest).rejects.toThrow("could not be recorded safely");
    await expect(readVoicePreviewEvidence(runId, voiceId)).resolves.toEqual(newer);
    const previewFiles = await readdir(artifactPath(runId, `${voicePreviewDirectory}/${voiceId}`));
    const registeredPreviewFiles = (await loadRun(runId)).artifacts
      .filter((relativePath) => relativePath.startsWith(`${voicePreviewDirectory}/${voiceId}/`))
      .map((relativePath) => relativePath.split("/").at(-1))
      .filter((fileName): fileName is string => fileName !== undefined);
    expect([...previewFiles].sort((left, right) => left.localeCompare(right))).toEqual(
      [...registeredPreviewFiles].sort((left, right) => left.localeCompare(right)),
    );
  });

  it("rejects an older concurrent selection instead of overwriting the newer decision", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    const blocked = deferred<void>();
    const release = deferred<void>();
    const older = selectVoice(
      runId,
      { voiceId, reviewedBy: "older-operator", notes: "older decision" },
      {
        async beforeCommit() {
          blocked.resolve();
          await release.promise;
        },
      },
    );
    await blocked.promise;
    const newer = await selectVoice(runId, {
      voiceId,
      reviewedBy: "newer-operator",
      notes: "newer decision",
    });
    release.resolve();

    await expect(older).rejects.toThrow("Voice evidence changed");
    await expect(readVoiceSelection(runId)).resolves.toEqual(newer);
  });
});
