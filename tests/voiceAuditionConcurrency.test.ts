import { describe, expect, it } from "vitest";

import { loadRun } from "../src/core/runStore";
import { isVoicePreviewFailureArtifactPath } from "../src/stages/voice/catalog/voiceAuditionContracts";
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
