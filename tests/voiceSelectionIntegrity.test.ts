import { readFile, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import {
  voicePreviewAudioPath,
  voicePreviewEvidencePath,
  voiceSelectionArtifactPath,
  type VoiceSelection,
} from "../src/stages/voice/catalog/voiceAuditionContracts";
import { canonicalVoiceEvidenceDigest } from "../src/stages/voice/catalog/voiceCatalogDigest";
import {
  readCurrentVoiceSelection,
  readVoiceSelection,
  readVoiceSelectionWithPath,
} from "../src/stages/voice/catalog/voiceSelectionStore";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { useTempProject } from "./helpers";
import {
  candidateVoiceId,
  preparePaidVoiceSelection,
  prepareVoiceCatalog,
} from "./voiceAuditionStageFixtures";
import {
  configureElevenLabs,
  defaultCatalogVoice,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("voice selection integrity", () => {
  useTempProject();
  afterEach(() => vi.useRealTimers());

  it("rejects dot path segments in catalogs and voice audition artifacts", async () => {
    for (const dotSegment of [".", ".."]) {
      await expect(
        prepareVoiceCatalog({ voices: [defaultCatalogVoice({ voiceId: dotSegment })] }),
      ).rejects.toThrow();
      expect(() => voicePreviewAudioPath(dotSegment, "preview", "mp3")).toThrow("dot path segment");
      expect(() => voicePreviewEvidencePath(dotSegment, "preview")).toThrow("dot path segment");
      expect(() => voicePreviewAudioPath("voice", dotSegment, "mp3")).toThrow("dot path segment");
      expect(() => voiceSelectionArtifactPath(dotSegment)).toThrow("dot path segment");
    }
  });

  it("rejects recomputed paid-rights tampering and current synthesis-config drift", async () => {
    const { runId, selectionPath } = await preparePaidVoiceSelection();
    const persisted = JSON.parse(
      await readFile(artifactPath(runId, selectionPath), "utf8"),
    ) as VoiceSelection;
    persisted.subscription.productionUseStatus = "blocked-free-tier";
    persisted.productionRights = { required: false, confirmed: false };
    const { selectionDigest: _ignored, ...unsigned } = persisted;
    persisted.selectionDigest = canonicalVoiceEvidenceDigest(unsigned);
    await writeFile(
      artifactPath(runId, selectionPath),
      `${JSON.stringify(persisted, null, 2)}\n`,
      "utf8",
    );
    await expect(readCurrentVoiceSelection(runId)).rejects.toThrow(
      "does not match current catalog",
    );

    const clean = await preparePaidVoiceSelection();
    await configureElevenLabs({ outputFormat: "wav_48000" });
    await expect(readCurrentVoiceSelection(clean.runId)).rejects.toThrow(
      "does not match current catalog",
    );
  });

  it("blocks a candidate whose provider disable cutoff expires after preview", async () => {
    vi.useFakeTimers();
    const baseTime = new Date("2026-07-13T08:00:00.000Z");
    vi.setSystemTime(baseTime);
    const { catalog, runId } = await prepareVoiceCatalog({
      voices: [
        defaultCatalogVoice({
          sharing: {
            liveModerationEnabled: false,
            disableAtUnix: Math.floor(baseTime.getTime() / 1_000) + 60,
          },
        }),
      ],
    });
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    vi.setSystemTime(new Date(baseTime.getTime() + 120_000));

    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "expired cutoff" }),
    ).rejects.toThrow("voice is disabled");
  });

  it("rejects terminal-control injection at selection input and persisted evidence", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "   ", notes: "valid notes" }),
    ).rejects.toThrow();
    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator", notes: " \n\t " }),
    ).rejects.toThrow();
    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator\u001b[31m", notes: "unsafe reviewer" }),
    ).rejects.toThrow("unsafe controls");
    await expect(
      selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "unsafe\u009b31m notes" }),
    ).rejects.toThrow("unsafe controls");

    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, { voiceId, reviewedBy: "operator", notes: "safe selection" });
    const current = await readVoiceSelectionWithPath(runId);
    const persisted = { ...current.selection, selectedBy: "operator\u001b[31m" };
    const { selectionDigest: _ignored, ...unsigned } = persisted;
    await writeFile(
      artifactPath(runId, current.path),
      `${JSON.stringify(
        { ...persisted, selectionDigest: canonicalVoiceEvidenceDigest(unsigned) },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await expect(readVoiceSelection(runId)).rejects.toThrow("unsafe controls");
  });
});
