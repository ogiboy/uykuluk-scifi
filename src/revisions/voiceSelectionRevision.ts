import { z } from "zod";

import { artifactPath, recordRunArtifact } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, mutateRun } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { readCostEstimate } from "../costs/costEstimate.js";
import { withCostReservationLock } from "../costs/costReservationLock.js";
import { readCostReservationSummaries } from "../costs/costReservationStore.js";
import { filesystemSegmentSchema } from "../stages/voice/catalog/voiceCatalogContracts.js";
import {
  hasUnsafeControlCharacters,
  hasUnsafeNotesControlCharacters,
} from "../stages/voice/catalog/voiceCatalogValueNormalization.js";
import { readVoiceSelectionWithPath } from "../stages/voice/catalog/voiceSelectionStore.js";
import { voiceoverAudioArtifactPaths } from "../stages/voice/voiceoverEvidence.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { createId, nowIso } from "../utils/time.js";
import {
  archiveVoiceSelectionRevisionSources,
  removeVoiceSelectionRevisionSources,
  restoreVoiceSelectionRevisionSources,
  verifyVoiceSelectionRevisionArchives,
  type ArchivedVoiceSelectionSource,
} from "./voiceSelectionRevisionArchive.js";

const revisableStates = [
  "COST_ESTIMATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
] as const;

const inputSchema = z.strictObject({
  runId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .refine((value) => !hasUnsafeNotesControlCharacters(value), "Reason contains unsafe controls."),
  reviewedBy: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !hasUnsafeControlCharacters(value), "Reviewer contains unsafe controls."),
});

export const voiceSelectionRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revisionId: z.string().min(1),
  runId: z.string().min(1),
  previousState: z.enum(revisableStates),
  nextState: z.literal("PRODUCTION_PACKAGE_GENERATED"),
  reason: z.string().min(1),
  reviewedBy: z.string().min(1),
  previousSelection: z.strictObject({ path: z.string().min(1), digest: z.string().min(1) }),
  invalidatedApprovalIds: z.array(z.string().min(1)),
  supersededReleasedReservationIds: z.array(z.string().min(1)),
  invalidatedApprovals: z.array(
    z.strictObject({
      approvalId: z.string().min(1),
      approvedRef: z.string().min(1).optional(),
      createdAt: z.iso.datetime(),
    }),
  ),
  archivedArtifacts: z.array(
    z.strictObject({
      sourcePath: z.string().min(1),
      archivedPath: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      bytes: z.int().positive(),
    }),
  ),
  createdAt: z.iso.datetime(),
});

export type VoiceSelectionRevision = z.infer<typeof voiceSelectionRevisionSchema>;

/**
 * Reads a voice-selection revision and verifies its archived artifacts.
 *
 * @param runId - The run containing the revision
 * @param revisionId - The revision to read
 * @returns The validated voice-selection revision
 */
export async function readVoiceSelectionRevision(
  runId: string,
  revisionId: string,
): Promise<VoiceSelectionRevision> {
  const safeRevisionId = filesystemSegmentSchema.parse(revisionId);
  const revisionDir = `revisions/voice-selection/${safeRevisionId}`;
  const revisionPath = `${revisionDir}/revision.json`;
  const run = await loadRun(runId);
  if (!run.artifacts.includes(revisionPath)) {
    throw new SafeExitError("Voice-selection revision is not registered in run state.");
  }
  const revision = voiceSelectionRevisionSchema.parse(
    await readJsonFile<unknown>(artifactPath(runId, revisionPath)),
  );
  if (revision.runId !== runId || revision.revisionId !== safeRevisionId) {
    throw new SafeExitError("Voice-selection revision identity does not match its path.");
  }
  await verifyVoiceSelectionRevisionArchives(run, revisionDir, revision.archivedArtifacts);
  return revision;
}

/**
 * Creates a voice-selection revision and moves the run to `PRODUCTION_PACKAGE_GENERATED` for explicit reselection.
 *
 * The operation requires a revisable run with no active or attempted TTS reservations and no voice synthesis artifacts. It archives the prior selection and quote evidence, invalidates approvals tied to the active quote, and records the state change and revision in the ledger. Failures before the run mutation commits restore archived sources.
 *
 * @param rawInput - The run identifier, revision reason, and reviewer identity.
 * @param options - Optional hooks invoked after reservation checks and after the run mutation commits.
 * @returns The persisted voice-selection revision.
 */
export async function reviseVoiceSelection(
  rawInput: z.input<typeof inputSchema>,
  options: {
    afterReservationCheck?: () => Promise<void>;
    afterRunCommit?: () => Promise<void>;
  } = {},
): Promise<VoiceSelectionRevision> {
  const input = inputSchema.parse(rawInput);
  const stage = "revise-voice-selection";
  const revisionId = createId("revision");
  const revisionDir = `revisions/voice-selection/${revisionId}`;
  const archivedSources: ArchivedVoiceSelectionSource[] = [];
  let runMutationCommitted = false;
  try {
    return await withCostReservationLock(async () => {
      const result = await mutateRun(input.runId, async (current) => {
        let run = current;
        if (!revisableStates.includes(run.state as (typeof revisableStates)[number])) {
          return blockRevision(
            run.runId,
            `Voice reselection requires state ${revisableStates.join(", ")}; current state is ${run.state}.`,
          );
        }
        assertTransition(run.state, "PRODUCTION_PACKAGE_GENERATED");
        const ttsReservations = (await readCostReservationSummaries(run.runId)).filter(
          (item) => item.stage === "tts",
        );
        if (ttsReservations.some((item) => item.status !== "RELEASED")) {
          return blockRevision(
            run.runId,
            "Voice reselection is blocked after a TTS reservation or synthesis attempt starts.",
          );
        }
        await options.afterReservationCheck?.();
        for (const relativePath of voiceoverAudioArtifactPaths) {
          if (
            run.artifacts.includes(relativePath) ||
            (await pathExists(artifactPath(run.runId, relativePath)))
          ) {
            return blockRevision(
              run.runId,
              "Voice reselection is blocked after voice synthesis artifacts exist.",
            );
          }
        }

        const previousSelection = await readVoiceSelectionWithPath(run.runId);
        const activeQuote = await readCostEstimate(run.runId);
        const archive = await archiveVoiceSelectionRevisionSources({ run, revisionDir, stage });
        run = archive.run;
        archivedSources.push(...archive.archivedSources);

        const invalidatedApprovals = run.approvals
          .filter(
            (approval) =>
              approval.target === "paid-generation-cost" &&
              approval.approvedRef === activeQuote.digest,
          )
          .map((approval) => ({
            approvalId: approval.approvalId,
            ...(approval.approvedRef ? { approvedRef: approval.approvedRef } : {}),
            createdAt: approval.createdAt,
          }));
        const invalidatedApprovalIds = invalidatedApprovals.map(({ approvalId }) => approvalId);
        const revision = voiceSelectionRevisionSchema.parse({
          schemaVersion: 1,
          revisionId,
          runId: run.runId,
          previousState: run.state,
          nextState: "PRODUCTION_PACKAGE_GENERATED",
          reason: input.reason,
          reviewedBy: input.reviewedBy,
          previousSelection: {
            path: previousSelection.path,
            digest: previousSelection.selection.selectionDigest,
          },
          invalidatedApprovalIds,
          supersededReleasedReservationIds: ttsReservations.map(
            (reservation) => reservation.reservationId,
          ),
          invalidatedApprovals,
          archivedArtifacts: archive.archivedArtifacts,
          createdAt: nowIso(),
        });
        const revisionPath = `${revisionDir}/revision.json`;
        await writeJsonFile(artifactPath(run.runId, revisionPath), revision);
        run = await recordRunArtifact(run, stage, revisionPath);
        run = await removeVoiceSelectionRevisionSources(run, stage, archive.sourceArtifacts);
        return {
          run: {
            ...run,
            state: "PRODUCTION_PACKAGE_GENERATED" as const,
            approvals: run.approvals.filter(
              (approval) => !invalidatedApprovalIds.includes(approval.approvalId),
            ),
          },
          value: revision,
        };
      });
      runMutationCommitted = true;
      await options.afterRunCommit?.();
      await appendLedgerEvent({
        runId: result.run.runId,
        type: "STATE_CHANGED",
        stage,
        message: `State changed from ${result.value.previousState} to PRODUCTION_PACKAGE_GENERATED.`,
        data: {
          previousState: result.value.previousState,
          nextState: "PRODUCTION_PACKAGE_GENERATED",
        },
      });
      await appendLedgerEvent({
        runId: result.run.runId,
        type: "ARTIFACT_REVISED",
        stage,
        message: `Archived unspent voice selection and quote evidence as ${revisionId}.`,
        data: result.value,
      });
      return result.value;
    });
  } catch (error) {
    if (!runMutationCommitted) {
      await restoreVoiceSelectionRevisionSources(input.runId, revisionDir, archivedSources);
    }
    throw error;
  }
}

/**
 * Records a blocked voice-selection revision and terminates the operation.
 *
 * @param runId - The run whose revision was blocked
 * @param message - The reason the revision was blocked
 */
async function blockRevision(runId: string, message: string): Promise<never> {
  await appendLedgerEvent({
    runId,
    type: "GUARD_BLOCKED",
    stage: "revise-voice-selection",
    message,
  });
  throw new SafeExitError(message);
}
