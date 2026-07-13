import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun, mutateRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { reserveApprovedCost } from "../src/costs/costReservationService";
import { readCostReservationSummaries } from "../src/costs/costReservationStore";
import { executeReservedProviderOperation } from "../src/costs/reservedProviderExecution";
import { reviseVoiceSelection } from "../src/revisions/voiceSelectionRevision";
import { estimateCost } from "../src/stages/estimate";
import { isVoiceSelectionArtifactPath } from "../src/stages/voice/catalog/voiceAuditionContracts";
import { readCurrentVoiceSelection } from "../src/stages/voice/catalog/voiceSelectionStore";
import { selectVoice } from "../src/stages/voiceSelection";
import { pathExists } from "../src/utils/fs";
import { prepareApprovedSelectedVoiceRun } from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";

describe("voice reselection recovery", () => {
  useTempProject();

  it("archives pre-spend quote and selection evidence, invalidates cost approval, and reopens selection", async () => {
    const { runId, voiceId } = await prepareApprovedSelectedVoiceRun();
    const previousSelection = await readCurrentVoiceSelection(runId);
    const previousQuote = await readCostEstimate(runId);
    const legacySelectionPath =
      "production/audio/voice-selections/selection_legacy_registered.json";
    await writeFile(
      artifactPath(runId, legacySelectionPath),
      await readFile(artifactPath(runId, previousSelection.selectionPath)),
    );
    await mutateRun(runId, async (current) => {
      const currentSelectionIndex = current.artifacts.indexOf(previousSelection.selectionPath);
      if (currentSelectionIndex < 0) throw new Error("Expected registered current selection.");
      const artifacts = [...current.artifacts];
      artifacts.splice(currentSelectionIndex, 0, legacySelectionPath);
      return { run: { ...current, artifacts }, value: undefined };
    });

    const revision = await reviseVoiceSelection({
      runId,
      reason: "operator rejected the production voice after final audition",
      reviewedBy: "voice director",
    });

    expect(revision).toMatchObject({
      previousState: "READY_FOR_MANUAL_PRODUCTION",
      nextState: "PRODUCTION_PACKAGE_GENERATED",
      invalidatedApprovalIds: [expect.stringMatching(/^approval_/)],
      previousSelection: {
        path: previousSelection.selectionPath,
        digest: previousSelection.selection.selectionDigest,
      },
    });
    const run = await loadRun(runId);
    expect(run.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    expect(run.approvals.some((approval) => approval.target === "paid-generation-cost")).toBe(
      false,
    );
    expect(await pathExists(artifactPath(runId, "costs/estimate.json"))).toBe(false);
    expect(await pathExists(artifactPath(runId, "costs/estimate.md"))).toBe(false);
    await expect(readCurrentVoiceSelection(runId)).rejects.toThrow(/selection.*registered/i);
    expect(run.artifacts.filter(isVoiceSelectionArtifactPath)).toEqual([]);
    expect(
      revision.archivedArtifacts
        .filter((artifact) => isVoiceSelectionArtifactPath(artifact.sourcePath))
        .map((artifact) => artifact.sourcePath),
    ).toEqual(expect.arrayContaining([legacySelectionPath, previousSelection.selectionPath]));
    expect(await pathExists(artifactPath(runId, legacySelectionPath))).toBe(false);
    expect(await pathExists(artifactPath(runId, previousSelection.selectionPath))).toBe(false);
    for (const archived of revision.archivedArtifacts) {
      expect(await pathExists(artifactPath(runId, archived.archivedPath))).toBe(true);
    }
    await expect(estimateCost(runId)).rejects.toThrow(/voice selection|selection.*registered/i);

    const nextSelection = await selectVoice(runId, {
      voiceId,
      reviewedBy: "voice director",
      notes: "reselected after archived pre-spend recovery",
      confirmProductionRights: true,
    });
    expect(nextSelection.selectionDigest).not.toBe(previousSelection.selection.selectionDigest);
    await estimateCost(runId);
    expect((await readCostEstimate(runId)).digest).not.toBe(previousQuote.digest);
  });

  it("refuses reselection recovery after any TTS reservation exists", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const quote = await readCostEstimate(runId);
    const tts = quote.estimate.stages.find((stage) => stage.stage === "tts");
    if (!tts?.bindingDigest) throw new Error("Expected bound TTS quote fixture.");
    await reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "tts_reselection_already_reserved",
      adapterIdentity: {
        provider: tts.provider,
        model: tts.model,
        bindingDigest: tts.bindingDigest,
      },
    });

    await expect(
      reviseVoiceSelection({ runId, reason: "too late to reopen", reviewedBy: "voice director" }),
    ).rejects.toThrow(/reservation|spend|synthesis.*started/i);
    expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
    expect(await pathExists(artifactPath(runId, "costs/estimate.json"))).toBe(true);
  });

  it("serializes reselection against a concurrent reservation so only one can succeed", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const quote = await readCostEstimate(runId);
    const tts = quote.estimate.stages.find((stage) => stage.stage === "tts");
    if (!tts?.bindingDigest) throw new Error("Expected bound TTS quote fixture.");
    const reservationCheckReached = deferred();
    const releaseRevision = deferred();
    const revisionPromise = reviseVoiceSelection(
      { runId, reason: "concurrent operator reselection", reviewedBy: "voice director" },
      {
        afterReservationCheck: async () => {
          reservationCheckReached.resolve();
          await releaseRevision.promise;
        },
      },
    );
    await reservationCheckReached.promise;
    const reservationPromise = reserveApprovedCost({
      runId,
      stage: "tts",
      operationId: "tts_concurrent_reselection",
      adapterIdentity: {
        provider: tts.provider,
        model: tts.model,
        bindingDigest: tts.bindingDigest,
      },
    });
    await expect(
      Promise.race([
        reservationPromise.then(
          () => "settled",
          () => "settled",
        ),
        Promise.resolve("pending"),
      ]),
    ).resolves.toBe("pending");
    releaseRevision.resolve();

    const [revisionResult, reservationResult] = await Promise.allSettled([
      revisionPromise,
      reservationPromise,
    ]);
    expect(revisionResult.status).toBe("fulfilled");
    expect(reservationResult.status).toBe("rejected");
    const finalRun = await loadRun(runId);
    expect(finalRun.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    expect(finalRun.approvals.some((approval) => approval.target === "paid-generation-cost")).toBe(
      false,
    );
    expect(finalRun.artifacts.filter(isVoiceSelectionArtifactPath)).toEqual([]);
    expect(
      (await readCostReservationSummaries(runId)).filter(
        (reservation) => reservation.stage === "tts",
      ),
    ).toEqual([]);
  });

  it("allows a fresh selection and quote after a provider proves no request was sent", async () => {
    const { runId, voiceId } = await prepareApprovedSelectedVoiceRun();
    const quote = await readCostEstimate(runId);
    const tts = quote.estimate.stages.find((stage) => stage.stage === "tts");
    if (!tts?.bindingDigest) throw new Error("Expected bound TTS quote fixture.");
    await expect(
      executeReservedProviderOperation({
        runId,
        stage: "tts",
        operationId: "tts_definitely_not_sent_recovery",
        timeoutMs: 100,
        adapter: {
          provider: tts.provider,
          model: tts.model,
          bindingDigest: tts.bindingDigest,
          async execute() {
            return { kind: "definitely-not-sent", reason: "connection-not-opened" };
          },
        },
      }),
    ).resolves.toMatchObject({
      status: "definitely-not-sent",
      reservation: { status: "RELEASED" },
    });

    await expect(
      reviseVoiceSelection({
        runId,
        reason: "retry after provider confirmed no request was sent",
        reviewedBy: "voice director",
      }),
    ).resolves.toMatchObject({ nextState: "PRODUCTION_PACKAGE_GENERATED" });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "voice director",
      notes: "fresh selection after a proven non-send",
      confirmProductionRights: true,
    });
    await expect(estimateCost(runId)).resolves.toBeDefined();
    expect((await readCostEstimate(runId)).digest).not.toBe(quote.digest);
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
