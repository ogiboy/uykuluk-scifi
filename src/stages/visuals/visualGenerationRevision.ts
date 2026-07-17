import { createHash } from "node:crypto";
import path from "node:path";

import { readRegisteredArtifactBytes } from "../../core/artifactRevision.js";
import {
  artifactPath,
  recordRunArtifact,
  removeRunArtifact,
  writeRunJson,
} from "../../core/artifacts.js";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../../core/runLedgerOutbox.js";
import { mutateRun } from "../../core/runStore.js";
import { assertTransition } from "../../core/transitions.js";
import {
  archiveActiveCostEstimate,
  costEstimateArchivePaths,
} from "../../costs/costEstimateHistory.js";
import { readCostEstimateAtProjectRoot } from "../../costs/costEstimateStore.js";
import { withCostReservationLock } from "../../costs/costReservationLock.js";
import { readCostReservationSummaries } from "../../costs/costReservationStore.js";
import { ensureDir, writeBinaryFile } from "../../utils/fs.js";
import { createId, nowIso } from "../../utils/time.js";
import { captureVisualArtifactRollback } from "./visualArtifactRollback.js";
import { requireHostedVisualGenerationPlan } from "./visualGenerationPlan.js";
import {
  hostedVisualGenerationPlanPath,
  type HostedVisualGenerationPlan,
} from "./visualGenerationPlanContracts.js";
import {
  assertSettledSource,
  hostedVisualDerivedArtifacts,
  hostedVisualGenerationRevisionSchema,
  hostedVisualRevisableStates,
  hostedVisualRevisionInputSchema,
  type HostedVisualGenerationRevision,
  type HostedVisualGenerationRevisionInput,
} from "./visualGenerationRevisionEvidence.js";
import {
  hostedVisualRevisionBlocked as blocked,
  findHostedVisualQuoteApproval,
  hostedVisualRevisionPaths,
  persistHostedVisualRevisionBlock,
  requireRejectedHostedVisualScenes,
  requireUniqueHostedVisualSceneIndexes,
} from "./visualGenerationRevisionGuard.js";
import { loadVisualManifest } from "./visualManifest.js";
import { assertVisualMutationExpectation } from "./visualMutationExpectation.js";

export {
  hostedVisualGenerationRevisionSchema,
  readHostedVisualGenerationRevision,
  type HostedVisualGenerationRevision,
} from "./visualGenerationRevisionEvidence.js";

/**
 * Reopens rejected hosted visual scenes and records a new generation revision.
 *
 * Validates the replacement plan against the current rejected-scene snapshot and
 * requires settled image-generation reservations with matching plan, quote, and
 * approval evidence. Archives the prior plan and cost evidence, removes derived
 * artifacts, installs the replacement plan, updates the run ledger, and restores
 * the run to `PRODUCTION_PACKAGE_GENERATED`. Failed mutation checks are persisted
 * as a blocked revision outcome.
 *
 * @param rawInput - The run, rejected scene indexes, reason, and reviewer identity
 *   for the reopening request.
 * @param options - The replacement plan and an optional hook invoked after
 *   reservation checks and before artifact mutation.
 * @returns The persisted hosted visual generation revision.
 */
export async function reopenRejectedHostedVisualGeneration(
  rawInput: HostedVisualGenerationRevisionInput,
  options: Readonly<{
    afterReservationCheck?: () => Promise<void>;
    replacementPlan: HostedVisualGenerationPlan;
  }>,
): Promise<HostedVisualGenerationRevision> {
  const input = hostedVisualRevisionInputSchema.parse(rawInput);
  const replacementPlan = requireHostedVisualGenerationPlan(options.replacementPlan);
  const stage = "visuals-hosted-reopen";
  const revisionId = createId("revision");
  const { archivedPlanPath, revisionPath } = hostedVisualRevisionPaths(revisionId);
  await reconcileRunLedgerOutbox(input.runId);
  let revision: HostedVisualGenerationRevision;
  try {
    revision = await withCostReservationLock(async () => {
      const { value } = await mutateRun(input.runId, async (current, transaction) => {
        if (
          !hostedVisualRevisableStates.includes(
            current.state as (typeof hostedVisualRevisableStates)[number],
          )
        ) {
          throw await blocked(
            current.runId,
            `Hosted visual regeneration requires state ${hostedVisualRevisableStates.join(" or ")}; current state is ${current.state}.`,
          );
        }
        if (current.state !== "PRODUCTION_PACKAGE_GENERATED") {
          assertTransition(current.state, "PRODUCTION_PACKAGE_GENERATED");
        }
        const manifest = await loadVisualManifest(current);
        assertVisualMutationExpectation(manifest, input);
        const requestedSceneIndexes = await requireUniqueHostedVisualSceneIndexes(
          input.sceneIndexes,
        );
        const rejectedScenes = await requireRejectedHostedVisualScenes(
          manifest.manifest.scenes,
          requestedSceneIndexes,
        );
        if (rejectedScenes.length === 0) {
          throw await blocked(
            current.runId,
            "Hosted visual regeneration requires rejected active scenes.",
          );
        }
        if (
          replacementPlan.runId !== current.runId ||
          replacementPlan.purpose !== "regenerate-rejected" ||
          replacementPlan.visualManifest.digest !== manifest.digest ||
          JSON.stringify(replacementPlan.targetedSceneIndexes) !==
            JSON.stringify(requestedSceneIndexes)
        ) {
          throw await blocked(
            current.runId,
            "Replacement hosted visual plan does not match the current rejected-scene snapshot.",
          );
        }
        const reservations = (await readCostReservationSummaries(current.runId)).filter(
          (reservation) => reservation.stage === "imageGeneration",
        );
        const nonterminal = reservations.filter(
          (reservation) => !["RELEASED", "SETTLED"].includes(reservation.status),
        );
        if (nonterminal.length > 0) {
          throw await blocked(
            current.runId,
            "Hosted visual regeneration is blocked while an image-generation reservation is active or uncertain.",
          );
        }
        await options.afterReservationCheck?.();
        const settledById = new Map(
          reservations
            .filter((reservation) => reservation.status === "SETTLED")
            .map((reservation) => [reservation.reservationId, reservation]),
        );
        const selectedReservationIds: string[] = [];
        const selectedSources: HostedVisualGenerationRevision["selectedSources"] = [];
        for (const scene of rejectedScenes) {
          const active = scene.revisions.find((item) => item.revision === scene.activeRevision);
          if (active?.source.kind !== "hosted-generation") {
            throw await blocked(
              current.runId,
              `Rejected scene ${scene.sceneIndex} is not backed by settled hosted-generation evidence.`,
            );
          }
          assertSettledSource(active.source, settledById.get(active.source.reservationId));
          selectedReservationIds.push(active.source.reservationId);
          selectedSources.push({ sceneIndex: scene.sceneIndex, source: active.source });
        }
        const planBytes = await readRegisteredArtifactBytes(
          current,
          hostedVisualGenerationPlanPath,
        );
        if (!planBytes) {
          throw await blocked(
            current.runId,
            "Hosted visual regeneration requires the active generation plan.",
          );
        }
        const planDigest = createHash("sha256").update(planBytes).digest("hex");
        const activeQuoteApproval = findHostedVisualQuoteApproval(
          current.approvals,
          reservations,
          planDigest,
        );
        if (!activeQuoteApproval?.approvedRef) {
          throw await blocked(
            current.runId,
            "Hosted visual regeneration requires exact settled plan, quote, and approval evidence.",
          );
        }
        const activeQuote = await readCostEstimateAtProjectRoot(process.cwd(), current);
        if (activeQuote.digest !== activeQuoteApproval.approvedRef) {
          throw await blocked(
            current.runId,
            "Active hosted visual quote does not match its settled plan approval.",
          );
        }
        const quoteArchive = costEstimateArchivePaths(activeQuote.digest);
        transaction.onRollback(
          await captureVisualArtifactRollback(current.runId, stage, [
            "ledger.jsonl",
            hostedVisualGenerationPlanPath,
            archivedPlanPath,
            "costs/estimate.json",
            "costs/estimate.md",
            quoteArchive.jsonPath,
            quoteArchive.markdownPath,
            revisionPath,
            ...hostedVisualDerivedArtifacts,
          ]),
        );
        await ensureDir(path.dirname(artifactPath(current.runId, archivedPlanPath)));
        await writeBinaryFile(artifactPath(current.runId, archivedPlanPath), planBytes);
        let run = await recordRunArtifact(current, stage, archivedPlanPath);
        const archivedQuote = await archiveActiveCostEstimate({ run, stage });
        run = archivedQuote.run;
        if (
          archivedQuote.quote.digest !== activeQuoteApproval.approvedRef ||
          archivedQuote.archive.digest !== activeQuoteApproval.approvedRef
        ) {
          throw await blocked(
            current.runId,
            "Active hosted visual quote does not match its settled approval.",
          );
        }
        run = await removeRunArtifact(run, stage, hostedVisualGenerationPlanPath);
        run = await writeRunJson(run, stage, hostedVisualGenerationPlanPath, replacementPlan);
        const removedDerivedArtifacts: string[] = [];
        for (const relativePath of hostedVisualDerivedArtifacts) {
          if (run.artifacts.includes(relativePath)) removedDerivedArtifacts.push(relativePath);
          run = await removeRunArtifact(run, stage, relativePath);
        }
        const value = hostedVisualGenerationRevisionSchema.parse({
          schemaVersion: 1,
          revisionId,
          runId: run.runId,
          previousState: current.state,
          nextState: "PRODUCTION_PACKAGE_GENERATED",
          reason: input.reason,
          reviewedBy: input.reviewedBy,
          rejectedSceneIndexes: requestedSceneIndexes,
          previousPlan: { path: hostedVisualGenerationPlanPath, digest: planDigest },
          previousQuote: {
            digest: archivedQuote.quote.digest,
            approvalId: activeQuoteApproval.approvalId,
            jsonPath: archivedQuote.archive.jsonPath,
            markdownPath: archivedQuote.archive.markdownPath,
          },
          archivedPlanPath,
          selectedSources,
          settledReservationIds: Array.from(new Set(selectedReservationIds)),
          removedDerivedArtifacts,
          createdAt: nowIso(),
        });
        run = await writeRunJson(run, stage, revisionPath, value);
        if (current.state !== "PRODUCTION_PACKAGE_GENERATED") {
          run = queueRunLedgerEvent(run, {
            type: "STATE_CHANGED",
            stage,
            message: `State changed from ${current.state} to PRODUCTION_PACKAGE_GENERATED.`,
            data: { previousState: current.state, nextState: "PRODUCTION_PACKAGE_GENERATED" },
          });
        }
        run = queueRunLedgerEvent(run, {
          type: "ARTIFACT_REVISED",
          stage,
          message: `Archived settled hosted visual plan and quote as ${revisionId}.`,
          data: value,
        });
        return { run: { ...run, state: "PRODUCTION_PACKAGE_GENERATED" as const }, value };
      });
      return value;
    });
  } catch (error) {
    return persistHostedVisualRevisionBlock(input.runId, error);
  }
  await reconcileRunLedgerOutbox(input.runId);
  return revision;
}
