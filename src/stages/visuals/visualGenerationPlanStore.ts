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

/** Persists the exact hosted scene plan that a later quote must bind. */
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
    if (!input.reason?.trim() || !input.reviewedBy?.trim()) {
      throw new SafeExitError(
        "Rejected hosted visual regeneration requires reviewer attribution and a reason.",
      );
    }
    const expectation = visualMutationExpectationSchema.parse({
      expectedActiveRevisions: input.expectedActiveRevisions,
      expectedManifestDigest: input.expectedManifestDigest,
    });
    const loadedManifest = await loadVisualManifest(current);
    let plan: HostedVisualGenerationPlan;
    try {
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

/** Reads the registered plan and proves it still matches manifest, run, config, and pricing. */
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

/** Reads and structurally verifies the registered plan without asserting current manifest freshness. */
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

function parsePersistedHostedVisualGenerationPlan(bytes: Buffer): HostedVisualGenerationPlan {
  try {
    return requireHostedVisualGenerationPlan(JSON.parse(bytes.toString("utf8")));
  } catch (error) {
    if (error instanceof SafeExitError) throw error;
    throw new SafeExitError("Hosted visual generation plan is malformed or invalid.");
  }
}
