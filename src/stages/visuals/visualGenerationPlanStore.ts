import { createHash } from "node:crypto";
import { loadConfig } from "../../config/config.js";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../core/artifactRevision.js";
import { writeRunJson } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { appendLedgerEvent } from "../../core/ledger.js";
import { loadRun, mutateRun } from "../../core/runStore.js";
import type { RunRecord } from "../../core/state.js";
import { requireState } from "../../safeguards/approvalGuard.js";
import { nowIso } from "../../utils/time.js";
import { captureVisualArtifactRollback } from "./visualArtifactRollback.js";
import {
  buildHostedVisualGenerationPlan,
  requireHostedVisualGenerationPlan,
} from "./visualGenerationPlan.js";
import {
  hostedVisualGenerationPlanPath,
  type HostedVisualGenerationPlan,
} from "./visualGenerationPlanContracts.js";
import { reopenRejectedHostedVisualGeneration } from "./visualGenerationRevision.js";
import { loadVisualManifest } from "./visualManifest.js";
import {
  assertVisualMutationExpectation,
  visualMutationExpectationSchema,
  type VisualMutationExpectation,
} from "./visualMutationExpectation.js";

export type LoadedHostedVisualGenerationPlan = Readonly<{
  digest: string;
  plan: HostedVisualGenerationPlan;
}>;

/**
 * Creates and persists a hosted visual generation plan bound to the active manifest and image-generation configuration.
 *
 * For rejected regeneration, requires reviewer attribution and a reason, validates the supplied manifest expectations,
 * and reopens the rejected generation with the replacement plan. For initial generation, requires the run to be in
 * `PRODUCTION_PACKAGE_GENERATED` state and persists the plan in the hosted visual plan artifact slot. Guard failures
 * are recorded as blocked ledger events during rejected regeneration.
 *
 * @param input - Run, generation purpose, target scene indexes, and optional mutation expectations.
 * @param options - Optional checks to perform after reserving a rejected generation for regeneration.
 * @returns The hosted visual generation plan created for the run.
 * @throws `SafeExitError` if rejected regeneration lacks reviewer attribution or a reason, or if its manifest
 * expectations cannot be satisfied.
 */
export async function prepareHostedVisualGenerationPlan(
  input: Readonly<{
    runId: string;
    purpose: "initial" | "regenerate-rejected";
    reason?: string;
    reviewedBy?: string;
    sceneIndexes: readonly number[];
  }> &
    Partial<VisualMutationExpectation>,
  options: Readonly<{ afterReservationCheck?: () => Promise<void> }> = {},
): Promise<HostedVisualGenerationPlan> {
  const config = await loadConfig();
  if (input.purpose === "regenerate-rejected") {
    const current = await loadRun(input.runId);
    let expectation: VisualMutationExpectation;
    let plan: HostedVisualGenerationPlan;
    try {
      if (!input.reason?.trim() || !input.reviewedBy?.trim()) {
        throw new SafeExitError(
          "Rejected hosted visual regeneration requires reviewer attribution and a reason.",
        );
      }
      expectation = visualMutationExpectationSchema.parse({
        expectedActiveRevisions: input.expectedActiveRevisions,
        expectedManifestDigest: input.expectedManifestDigest,
      });
      const loadedManifest = await loadVisualManifest(current);
      assertVisualMutationExpectation(loadedManifest, expectation);
      plan = buildHostedVisualGenerationPlan({
        runId: current.runId,
        createdAt: nowIso(),
        visualManifest: loadedManifest.manifest,
        visualManifestDigest: loadedManifest.digest,
        purpose: input.purpose,
        sceneIndexes: input.sceneIndexes,
        config: config.providers.imageGeneration,
      });
    } catch (error) {
      if (error instanceof SafeExitError) {
        await appendLedgerEvent({
          runId: current.runId,
          type: "GUARD_BLOCKED",
          stage: "visuals-hosted-reopen",
          message: error.message,
        });
      }
      throw error;
    }
    await reopenRejectedHostedVisualGeneration(
      {
        ...expectation,
        runId: input.runId,
        reason: input.reason,
        reviewedBy: input.reviewedBy,
        sceneIndexes: [...input.sceneIndexes],
      },
      { afterReservationCheck: options.afterReservationCheck, replacementPlan: plan },
    );
    return plan;
  }
  const { value } = await mutateRun(input.runId, async (run, transaction) => {
    await requireState(run, "PRODUCTION_PACKAGE_GENERATED", "visuals-hosted-plan");
    const loadedManifest = await loadVisualManifest(run);
    const plan = buildHostedVisualGenerationPlan({
      runId: run.runId,
      createdAt: nowIso(),
      visualManifest: loadedManifest.manifest,
      visualManifestDigest: loadedManifest.digest,
      purpose: input.purpose,
      sceneIndexes: input.sceneIndexes,
      config: config.providers.imageGeneration,
    });
    transaction.onRollback(
      await captureVisualArtifactRollback(run.runId, "visuals-hosted-plan", [
        hostedVisualGenerationPlanPath,
      ]),
    );
    const updatedRun = await writeRunJson(
      run,
      "visuals-hosted-plan",
      hostedVisualGenerationPlanPath,
      plan,
    );
    return { run: updatedRun, value: plan };
  });
  return value;
}

/**
 * Verifies that the persisted hosted visual generation plan matches the active visual manifest and image-generation configuration.
 *
 * @param run - The run whose registered hosted visual generation plan is loaded.
 * @param config - The loaded application configuration used to verify the plan binding.
 * @param projectRoot - The project root containing the run artifacts.
 * @returns The persisted plan and its exact artifact digest.
 * @throws SafeExitError If the plan is missing, malformed, or stale for the active manifest or configuration.
 */
export async function loadHostedVisualGenerationPlan(
  run: RunRecord,
  config: Awaited<ReturnType<typeof loadConfig>>,
  projectRoot = process.cwd(),
): Promise<LoadedHostedVisualGenerationPlan> {
  const loadedPlan = await loadPersistedHostedVisualGenerationPlan(run, projectRoot);
  const plan = loadedPlan.plan;
  const manifest = await loadVisualManifest(run, projectRoot);
  const expected = buildHostedVisualGenerationPlan({
    runId: run.runId,
    createdAt: plan.createdAt,
    visualManifest: manifest.manifest,
    visualManifestDigest: manifest.digest,
    purpose: plan.purpose,
    sceneIndexes: plan.targetedSceneIndexes,
    config: config.providers.imageGeneration,
  });
  if (plan.bindingDigest !== expected.bindingDigest) {
    throw new SafeExitError(
      "Hosted visual generation plan is stale for the active manifest or configuration.",
    );
  }
  return loadedPlan;
}

/**
 * Loads and structurally verifies the persisted hosted visual generation plan without checking its freshness against the current manifest.
 *
 * @param run - The run whose registered hosted visual generation plan is loaded
 * @param projectRoot - The project root containing the registered artifact
 * @returns The validated plan and SHA-256 digest of its persisted bytes
 * @throws `SafeExitError` if the plan is missing, malformed, or invalid
 */
export async function loadPersistedHostedVisualGenerationPlan(
  run: RunRecord,
  projectRoot = process.cwd(),
): Promise<LoadedHostedVisualGenerationPlan> {
  const bytes = await readRegisteredArtifactBytesAtProjectRoot(
    projectRoot,
    run,
    hostedVisualGenerationPlanPath,
  );
  if (!bytes) {
    throw new SafeExitError("Hosted visual generation plan is missing.");
  }
  const plan = parsePersistedHostedVisualGenerationPlan(bytes);
  return { digest: createHash("sha256").update(bytes).digest("hex"), plan };
}

/**
 * Parses and structurally validates persisted hosted visual generation plan data.
 *
 * @param bytes - UTF-8 encoded JSON plan data
 * @returns The validated hosted visual generation plan
 * @throws `SafeExitError` if the data is malformed or invalid
 */
function parsePersistedHostedVisualGenerationPlan(bytes: Buffer): HostedVisualGenerationPlan {
  try {
    return requireHostedVisualGenerationPlan(JSON.parse(bytes.toString("utf8")));
  } catch (error) {
    if (error instanceof SafeExitError) throw error;
    throw new SafeExitError("Hosted visual generation plan is malformed or invalid.");
  }
}
