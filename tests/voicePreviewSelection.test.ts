import { readFile, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { isVoiceSelectionArtifactPath } from "../src/stages/voice/catalog/voiceAuditionContracts";
import {
  readCurrentVoiceSelection,
  readVoiceSelection,
  readVoiceSelectionWithPath,
} from "../src/stages/voice/catalog/voiceSelectionStore";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { candidateVoiceId, prepareVoiceCatalog } from "./voiceAuditionStageFixtures";
import {
  configureElevenLabs,
  preparePackagedRun,
  previewMp3Bytes,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("voice preview and selection stages", () => {
  useTempProject();

  it("persists bounded local preview evidence and an attributable exact selection", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const preview = await generateVoicePreview(runId, candidateVoiceId(catalog), {
      provider: successfulPreviewProvider(catalog),
    });
    const selection = await selectVoice(runId, {
      voiceId: candidateVoiceId(catalog),
      reviewedBy: "operator@example.test",
      notes: "Türkçe telaffuz ve anlatım ritmi yerel olarak dinlendi.",
    });

    expect(preview).toMatchObject({
      catalogDigest: catalog.catalogDigest,
      output: { format: "mp3", bytes: previewMp3Bytes().byteLength },
    });
    expect(selection).toMatchObject({
      selectedBy: "operator@example.test",
      voice: {
        voiceId: candidateVoiceId(catalog),
        productionEligibility: { status: "preview-only" },
      },
      productionRights: { required: false, confirmed: false },
    });
    await expect(readCurrentVoiceSelection(runId)).resolves.toMatchObject({
      selection: { selectionDigest: selection.selectionDigest },
      preview: { previewDigest: preview.previewDigest },
    });
    const persisted = await readFile(artifactPath(runId, selection.preview.evidencePath), "utf8");
    expect(persisted).not.toContain("https://");
    expect(persisted).not.toContain("raw-preview-request");
    expect(persisted).not.toContain("ELEVENLABS_API_KEY");
    await expect(loadRun(runId)).resolves.toMatchObject({
      artifacts: expect.arrayContaining([
        selection.catalog.path,
        selection.preview.evidencePath,
        selection.preview.audioPath,
      ]),
    });
    expect((await readVoiceSelectionWithPath(runId)).path).toMatch(
      /^production\/audio\/voice-selections\//,
    );
  });

  it("detects audio tampering and archives a valid prior selection on reselection", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const preview = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    await writeFile(artifactPath(runId, preview.output.path), "tampered-audio", "utf8");
    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "tampered attempt" }),
    ).rejects.toThrow("does not match its evidence digest");

    await writeFile(artifactPath(runId, preview.output.path), previewMp3Bytes());
    const first = await selectVoice(runId, {
      voiceId,
      reviewedBy: "operator",
      notes: "first accepted audition",
    });
    const second = await selectVoice(runId, {
      voiceId,
      reviewedBy: "operator",
      notes: "second attributable review",
    });
    expect(second.selectionDigest).not.toBe(first.selectionDigest);
    const run = await loadRun(runId);
    const revisions = run.artifacts.filter(isVoiceSelectionArtifactPath);
    expect(revisions).toHaveLength(2);
    expect(await readFile(artifactPath(runId, revisions[0]), "utf8")).toContain(
      first.selectionDigest,
    );
    await expect(readVoiceSelection(runId)).resolves.toEqual(second);
  });

  it("requires explicit production-rights confirmation for a paid-tier selection", async () => {
    await configureElevenLabs();
    const runId = await preparePackagedRun();
    const catalog = await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({
        subscription: {
          tier: "creator",
          status: "active",
          characterCount: 1_000,
          characterLimit: 100_000,
          hasOpenInvoices: false,
        },
      }),
    });
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });

    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "paid audition" }),
    ).rejects.toThrow("explicit confirmation");
    const selected = await selectVoice(runId, {
      voiceId,
      reviewedBy: "operator",
      notes: "rights confirmed for production use",
      confirmProductionRights: true,
    });
    expect(selected.productionRights).toEqual({ required: true, confirmed: true });
    expect(
      await pathExists(artifactPath(runId, (await readVoiceSelectionWithPath(runId)).path)),
    ).toBe(true);
  });
});
