import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import {
  readVoiceSelectionRevision,
  reviseVoiceSelection,
} from "../src/revisions/voiceSelectionRevision";
import { estimateCost } from "../src/stages/estimate";
import { isVoiceSelectionArtifactPath } from "../src/stages/voice/catalog/voiceAuditionContracts";
import { readCurrentVoiceSelection } from "../src/stages/voice/catalog/voiceSelectionStore";
import { selectVoice } from "../src/stages/voiceSelection";
import { pathExists } from "../src/utils/fs";
import { prepareApprovedSelectedVoiceRun } from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";

describe("voice reselection persistence", () => {
  useTempProject();

  it("keeps the committed revision and stale sources removed when post-commit logging fails", async () => {
    const { runId, voiceId } = await prepareApprovedSelectedVoiceRun();
    const previousSelection = await readCurrentVoiceSelection(runId);

    await expect(
      reviseVoiceSelection(
        { runId, reason: "exercise the persistence boundary", reviewedBy: "voice director" },
        {
          afterRunCommit: async () => {
            throw new Error("simulated post-commit audit failure");
          },
        },
      ),
    ).rejects.toThrow("simulated post-commit audit failure");

    const committedRun = await loadRun(runId);
    expect(committedRun.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    expect(
      committedRun.approvals.some((approval) => approval.target === "paid-generation-cost"),
    ).toBe(false);
    expect(committedRun.artifacts.filter(isVoiceSelectionArtifactPath)).toEqual([]);
    expect(await pathExists(artifactPath(runId, previousSelection.selectionPath))).toBe(false);
    const revisionPath = committedRun.artifacts.find((relativePath) =>
      /^revisions\/voice-selection\/[^/]+\/revision\.json$/.test(relativePath),
    );
    if (!revisionPath) throw new Error("Expected committed voice-selection revision evidence.");
    const revisionId = revisionPath.split("/")[2];
    const revision = await readVoiceSelectionRevision(runId, revisionId);
    expect(revision.previousSelection.path).toBe(previousSelection.selectionPath);
    for (const archived of revision.archivedArtifacts) {
      expect(await pathExists(artifactPath(runId, archived.archivedPath))).toBe(true);
    }

    await selectVoice(runId, {
      voiceId,
      reviewedBy: "voice director",
      notes: "fresh selection after committed audit failure",
      confirmProductionRights: true,
    });
    await expect(estimateCost(runId)).resolves.toBeDefined();
  });

  it("detects tampering in archived reselection evidence", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const revision = await reviseVoiceSelection({
      runId,
      reason: "archive integrity review",
      reviewedBy: "voice director",
    });
    await expect(readVoiceSelectionRevision(runId, revision.revisionId)).resolves.toEqual(revision);
    const archived = revision.archivedArtifacts[0];
    await writeFile(artifactPath(runId, archived.archivedPath), "tampered\n", "utf8");

    await expect(readVoiceSelectionRevision(runId, revision.revisionId)).rejects.toThrow(
      /archive digest|revision archive/i,
    );
  });
});
