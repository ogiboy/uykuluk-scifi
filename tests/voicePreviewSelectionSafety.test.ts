import { readFile, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { artifactPath, writeRunJson } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import {
  isVoicePreviewFailureArtifactPath,
  voicePreviewFailurePath,
  voicePreviewFailureSchema,
} from "../src/stages/voice/catalog/voiceAuditionContracts";
import type { VoiceCandidates } from "../src/stages/voice/catalog/voiceCatalogContracts";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import type { VoicePreviewProvider } from "../src/stages/voice/catalog/voiceCatalogProvider";
import {
  readVoiceCandidates,
  readVoiceCandidatesWithPath,
  readVoicePreviewEvidence,
  readVoicePreviewEvidenceWithPath,
} from "../src/stages/voice/catalog/voiceCatalogStore";
import {
  readCurrentVoiceSelection,
  readVoiceSelection,
} from "../src/stages/voice/catalog/voiceSelectionStore";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { candidateVoiceId, prepareVoiceCatalog } from "./voiceAuditionStageFixtures";
import { defaultCatalogVoice, successfulPreviewProvider } from "./voiceCatalogStageFixtures";

describe("voice preview and selection safety", () => {
  useTempProject();

  it("invalidates stale preview evidence and records redacted diagnostics after a failed refresh", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const preview = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    const previous = await readVoicePreviewEvidenceWithPath(runId, voiceId);
    const failing: VoicePreviewProvider = {
      provider: "elevenlabs",
      assertReady() {},
      async fetchPreview() {
        throw new Error("upstream-signed-url-secret");
      },
    };

    await expect(generateVoicePreview(runId, voiceId, { provider: failing })).rejects.toThrow(
      "could not be recorded safely",
    );
    expect(await pathExists(artifactPath(runId, preview.output.path))).toBe(true);
    expect(await pathExists(artifactPath(runId, previous.path))).toBe(true);
    await expect(readVoicePreviewEvidence(runId, voiceId)).rejects.toThrow(
      "latest voice preview refresh failed",
    );
    const failurePath = (await loadRun(runId)).artifacts
      .filter((relativePath) => isVoicePreviewFailureArtifactPath(relativePath, voiceId))
      .at(-1);
    expect(failurePath).toBeDefined();
    const diagnostic = await readFile(artifactPath(runId, failurePath!), "utf8");
    expect(diagnostic).not.toContain("upstream-signed-url-secret");
    expect(diagnostic).toContain('"code": "provider-unavailable"');
  });

  it("blocks stale catalogs and candidates with unsafe production metadata", async () => {
    const { catalog, runId } = await prepareVoiceCatalog({
      voices: [defaultCatalogVoice({ sharing: { liveModerationEnabled: true, rate: 2 } })],
    });
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "blocked voice" }),
    ).rejects.toThrow("Blocked voice candidates");

    const target = artifactPath(runId, (await readVoiceCandidatesWithPath(runId)).path);
    const persisted = JSON.parse(await readFile(target, "utf8")) as VoiceCandidates;
    persisted.fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString();
    const { catalogDigest: _ignored, ...unsigned } = persisted;
    persisted.catalogDigest = canonicalVoiceEvidenceDigest(unsigned);
    await writeFile(target, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
    await expect(
      generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(persisted) }),
    ).rejects.toThrow("could not be recorded safely");
    const failurePath = (await loadRun(runId)).artifacts
      .filter((relativePath) => isVoicePreviewFailureArtifactPath(relativePath, voiceId))
      .at(-1);
    expect(failurePath).toBeDefined();
    const diagnostic = await readFile(artifactPath(runId, failurePath!), "utf8");
    expect(diagnostic).toContain('"code": "catalog-stale"');
  });

  it("rejects orphan catalog, preview, audio, and selection files that are not registered", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "registration contract" });
    const current = await readCurrentVoiceSelection(runId);
    const cases = [
      {
        path: current.catalogPath,
        read: () => readVoiceCandidates(runId),
        expected: "No current voice candidate catalog",
      },
      {
        path: current.previewPath,
        read: () => readVoicePreviewEvidence(runId, voiceId),
        expected: "No current voice preview evidence",
      },
      {
        path: current.preview.output.path,
        read: () => readVoicePreviewEvidence(runId, voiceId),
        expected: "not registered",
      },
      {
        path: current.selectionPath,
        read: () => readVoiceSelection(runId),
        expected: "No current voice selection",
      },
    ];

    for (const testCase of cases) {
      const before = await loadRun(runId);
      await saveRun({
        ...before,
        artifacts: before.artifacts.filter((relativePath) => relativePath !== testCase.path),
      });
      await expect(testCase.read()).rejects.toThrow(testCase.expected);
      expect(await pathExists(artifactPath(runId, testCase.path))).toBe(true);
      const without = await loadRun(runId);
      await saveRun({ ...without, artifacts: [...without.artifacts, testCase.path] });
    }
  });

  it("scopes legacy preview failures to their persisted candidate", async () => {
    const { catalog, runId } = await prepareVoiceCatalog({
      voices: [
        defaultCatalogVoice({ voiceId: "voice_a", name: "Voice A" }),
        defaultCatalogVoice({ voiceId: "voice_b", name: "Voice B" }),
      ],
    });
    const voiceId = candidateVoiceId(catalog);
    const otherVoiceId = catalog.candidates.find(
      (candidate) => candidate.voiceId !== voiceId,
    )!.voiceId;
    const preview = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    const legacyFailure = voicePreviewFailureSchema.parse({
      schemaVersion: 1,
      runId,
      createdAt: new Date().toISOString(),
      provider: "elevenlabs",
      voiceId: otherVoiceId,
      code: "provider-unavailable",
      message: "Legacy preview failed safely.",
      nextAction: "Audition this candidate again.",
    });
    const run = await loadRun(runId);
    await saveRun(await writeRunJson(run, "test", voicePreviewFailurePath, legacyFailure));

    await expect(readVoicePreviewEvidence(runId, voiceId)).resolves.toEqual(preview);
    await expect(readVoicePreviewEvidence(runId, otherVoiceId)).rejects.toThrow(
      "latest voice preview refresh failed",
    );
  });
});
