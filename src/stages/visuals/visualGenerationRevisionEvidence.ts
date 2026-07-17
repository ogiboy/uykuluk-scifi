import { createHash } from "node:crypto";
import { z } from "zod";
import { readRegisteredArtifactBytes } from "../../core/artifactRevision.js";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { loadRun } from "../../core/runStore.js";
import { costEstimateArchivePaths } from "../../costs/costEstimateHistory.js";
import { readCostEstimateByDigestAtProjectRoot } from "../../costs/costEstimateStore.js";
import {
  readCostReservationSummaries,
  type CostReservationSummary,
} from "../../costs/costReservationStore.js";
import { readJsonFile } from "../../utils/json.js";
import { requireHostedVisualSceneSpoolMatch } from "./hostedVisualSpoolEvidence.js";
import { hostedVisualSourceSchema, type VisualRevision } from "./visualContracts.js";
import { canonicalVisualGenerationDigest } from "./visualGenerationDigest.js";
import { requireHostedVisualGenerationPlan } from "./visualGenerationPlan.js";
import { hostedVisualGenerationPlanPath } from "./visualGenerationPlanContracts.js";
import {
  loadHostedVisualGenerationSpoolForOperation,
  type LoadedHostedVisualGenerationSpool,
} from "./visualGenerationSpool.js";
import { loadVisualManifest } from "./visualManifest.js";
import { visualMutationExpectationSchema } from "./visualMutationExpectation.js";

export const hostedVisualRevisableStates = [
  "PRODUCTION_PACKAGE_GENERATED",
  "PAID_GENERATION_COST_APPROVED",
  "READY_FOR_MANUAL_PRODUCTION",
] as const;

export const hostedVisualRevisionInputSchema = z.strictObject({
  ...visualMutationExpectationSchema.shape,
  runId: z.string().min(1),
  reason: z.string().trim().min(1).max(1_000),
  reviewedBy: z.string().trim().min(1).max(200),
  sceneIndexes: z.array(z.int().positive().max(24)).min(1).max(24),
});

export type HostedVisualGenerationRevisionInput = z.input<typeof hostedVisualRevisionInputSchema>;

export const hostedVisualDerivedArtifacts = [
  "evidence_bundle.json",
  "evidence_bundle.md",
  "diagnostics/readiness.json",
  "diagnostics/readiness.md",
] as const;

export const hostedVisualGenerationRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revisionId: z.string().min(1),
  runId: z.string().min(1),
  previousState: z.enum(hostedVisualRevisableStates),
  nextState: z.literal("PRODUCTION_PACKAGE_GENERATED"),
  reason: z.string().min(1),
  reviewedBy: z.string().min(1),
  rejectedSceneIndexes: z.array(z.int().positive()).min(1).max(24),
  previousPlan: z.strictObject({
    path: z.string().min(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  previousQuote: z.strictObject({
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    approvalId: z.string().min(1),
    jsonPath: z.string().min(1),
    markdownPath: z.string().min(1),
  }),
  archivedPlanPath: z.string().min(1),
  selectedSources: z
    .array(z.strictObject({ sceneIndex: z.int().positive(), source: hostedVisualSourceSchema }))
    .min(1)
    .max(24),
  settledReservationIds: z.array(z.string().min(1)).min(1),
  removedDerivedArtifacts: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
});

export type HostedVisualGenerationRevision = z.infer<typeof hostedVisualGenerationRevisionSchema>;

/**
 * Verifies and loads a hosted visual revision and its archived plan, approved quote, source evidence, and settled reservations.
 *
 * @param runId - Identifier of the run containing the registered revision artifacts.
 * @param revisionId - Identifier of the revision to validate.
 * @returns The validated hosted visual generation revision.
 * @throws SafeExitError If the revision is unregistered, inconsistent with its path, or fails plan, quote, approval, source, evidence, or reservation checks.
 */
export async function readHostedVisualGenerationRevision(
  runId: string,
  revisionId: string,
): Promise<HostedVisualGenerationRevision> {
  const safeRevisionId = z
    .string()
    .regex(/^revision_[a-zA-Z0-9_]+$/)
    .parse(revisionId);
  const revisionPath = `revisions/hosted-visual/${safeRevisionId}/revision.json`;
  const run = await loadRun(runId);
  if (!run.artifacts.includes(revisionPath)) {
    throw new SafeExitError("Hosted visual revision is not registered in run state.");
  }
  const revision = hostedVisualGenerationRevisionSchema.parse(
    await readJsonFile<unknown>(artifactPath(runId, revisionPath)),
  );
  if (revision.runId !== runId || revision.revisionId !== safeRevisionId) {
    throw new SafeExitError("Hosted visual revision identity does not match its path.");
  }
  const expectedQuotePaths = costEstimateArchivePaths(revision.previousQuote.digest);
  const expectedPlanArchivePath = `revisions/hosted-visual/${safeRevisionId}/invalidated/${hostedVisualGenerationPlanPath}`;
  if (
    revision.previousPlan.path !== hostedVisualGenerationPlanPath ||
    revision.archivedPlanPath !== expectedPlanArchivePath ||
    revision.previousQuote.jsonPath !== expectedQuotePaths.jsonPath ||
    revision.previousQuote.markdownPath !== expectedQuotePaths.markdownPath
  ) {
    throw new SafeExitError("Hosted visual revision archive paths are not canonical.");
  }
  const planBytes = await readRegisteredArtifactBytes(run, revision.archivedPlanPath);
  if (
    !planBytes ||
    createHash("sha256").update(planBytes).digest("hex") !== revision.previousPlan.digest
  ) {
    throw new SafeExitError("Hosted visual revision plan archive digest does not match.");
  }
  const archivedPlan = requireHostedVisualGenerationPlan(
    JSON.parse(planBytes.toString("utf8")) as unknown,
  );
  const quote = await readCostEstimateByDigestAtProjectRoot(
    process.cwd(),
    run,
    revision.previousQuote.digest,
  );
  if (
    quote.digest !== revision.previousQuote.digest ||
    !run.artifacts.includes(revision.previousQuote.jsonPath) ||
    !run.artifacts.includes(revision.previousQuote.markdownPath)
  ) {
    throw new SafeExitError("Hosted visual revision quote archive does not match.");
  }
  const approval = run.approvals.find(
    (item) =>
      item.approvalId === revision.previousQuote.approvalId &&
      item.target === "paid-generation-cost" &&
      item.approvedRef === revision.previousQuote.digest,
  );
  const quoteLine = quote.estimate.stages.find((stage) => stage.stage === "imageGeneration");
  if (
    !approval ||
    quoteLine?.provider !== archivedPlan.provider ||
    quoteLine.model !== archivedPlan.model ||
    quoteLine.bindingDigest !== revision.previousPlan.digest
  ) {
    throw new SafeExitError("Hosted visual revision quote approval does not match its plan.");
  }
  const reservations = await readCostReservationSummaries(runId);
  const reservationsById = new Map(
    reservations.map((reservation) => [reservation.reservationId, reservation]),
  );
  const spoolByReservationId = new Map<string, LoadedHostedVisualGenerationSpool>();
  const manifest = await loadVisualManifest(run);
  const selectedSceneIndexes = revision.selectedSources.map((item) => item.sceneIndex);
  if (
    JSON.stringify([...new Set(selectedSceneIndexes)].sort((left, right) => left - right)) !==
    JSON.stringify([...revision.rejectedSceneIndexes].sort((left, right) => left - right))
  ) {
    throw new SafeExitError("Hosted visual revision selected sources do not match its scenes.");
  }
  const expectedReservationIds = await Promise.all(
    revision.selectedSources.map(async ({ sceneIndex, source }) => {
      const scene = manifest.manifest.scenes.find((item) => item.sceneIndex === sceneIndex);
      const sourceDigest = canonicalVisualGenerationDigest(source);
      const historicalRevision = scene?.revisions.find(
        (candidate) =>
          candidate.source.kind === "hosted-generation" &&
          canonicalVisualGenerationDigest(candidate.source) === sourceDigest,
      );
      if (!historicalRevision) {
        throw new SafeExitError(
          `Hosted visual revision scene ${sceneIndex} has no matching historical source.`,
        );
      }
      if (
        !run.approvals.some(
          (item) =>
            item.approvalId === source.approvalId &&
            item.target === "paid-generation-cost" &&
            item.approvedRef === source.quoteDigest,
        )
      ) {
        throw new SafeExitError(
          `Hosted visual revision scene ${sceneIndex} has no matching source approval.`,
        );
      }
      const sourceReservation = reservationsById.get(source.reservationId);
      if (!sourceReservation?.resultEvidenceDigest) {
        throw new SafeExitError(
          `Hosted visual revision scene ${sceneIndex} is missing settled result evidence.`,
        );
      }
      let sourceSpool = spoolByReservationId.get(source.reservationId);
      if (!sourceSpool) {
        sourceSpool = await loadHostedVisualGenerationSpoolForOperation(
          runId,
          sourceReservation.operationId,
          sourceReservation.resultEvidenceDigest,
        );
        spoolByReservationId.set(source.reservationId, sourceSpool);
      }
      requireHostedVisualSceneSpoolMatch({
        sceneIndex,
        revision: historicalRevision,
        reservation: sourceReservation,
        spool: sourceSpool,
      });
      return source.reservationId;
    }),
  );
  if (
    JSON.stringify([...new Set(revision.settledReservationIds)].sort()) !==
    JSON.stringify([...new Set(expectedReservationIds)].sort())
  ) {
    throw new SafeExitError(
      "Hosted visual revision reservation identities do not match its scenes.",
    );
  }
  return revision;
}

/**
 * Verifies that a hosted visual source is backed by matching settled reservation evidence.
 *
 * @param source - The hosted-generation source whose approval, plan, quote, operation, and result evidence must match.
 * @param reservation - The reservation summary to validate.
 * @throws SafeExitError If the reservation is missing, unsettled, or does not match the source evidence.
 */
export function assertSettledSource(
  source: Extract<VisualRevision["source"], { kind: "hosted-generation" }>,
  reservation: CostReservationSummary | undefined,
): void {
  if (
    reservation?.status !== "SETTLED" ||
    reservation.operationId !== source.operationId ||
    reservation.bindingDigest !== source.planDigest ||
    reservation.quoteDigest !== source.quoteDigest ||
    reservation.approvalId !== source.approvalId ||
    reservation.resultEvidenceDigest !== source.resultSpool.digest
  ) {
    throw new SafeExitError(
      "Rejected hosted visual source does not match settled reservation evidence.",
    );
  }
}
