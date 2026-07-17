import { loadConfigAtProjectRoot } from "../../../../../src/config/config";
import {
  readCostEstimateAtProjectRoot,
  validateCurrentCostEstimate,
} from "../../../../../src/costs/costEstimate";
import { requireSettledAppliedHostedVisualPlan } from "../../../../../src/stages/visuals/hostedVisualPlanCompletion";
import { hostedVisualGenerationPlanPath } from "../../../../../src/stages/visuals/visualGenerationPlanContracts";
import {
  loadHostedVisualGenerationPlan,
  loadPersistedHostedVisualGenerationPlan,
} from "../../../../../src/stages/visuals/visualGenerationPlanStore";
import type { readCoreVisualRunRecord } from "./visualRunRecord";

export type StudioHostedVisualSummary = Readonly<{
  approval: Readonly<{
    approvalId?: string;
    status: "approved" | "blocked" | "missing" | "pending";
  }>;
  execution: Readonly<{ approvalId: string; bindingDigest: string; quoteDigest: string }> | null;
  blockedReason?: string;
  eligibleRejectedSceneIndexes: readonly number[];
  mode: "hosted" | "static-manual" | "unknown";
  provider: StudioVisualProviderSummary | null;
  allowedPlanPurpose: "initial" | "regenerate-rejected" | null;
  plan: Readonly<{
    digest?: string;
    purpose?: "initial" | "regenerate-rejected";
    sceneIndexes: readonly number[];
    status: "blocked" | "missing" | "ready" | "settled";
  }>;
  quote: Readonly<{
    digest?: string;
    estimatedUsd?: number;
    status: "blocked" | "missing" | "ready";
  }>;
}>;

export type StudioVisualProviderSummary = Readonly<{
  credentialStatus: "configured" | "missing";
  kind: "hosted";
  label: string;
  modelId: string;
  modelLabel: string;
  providerId: string;
  readiness: "experimental";
}>;

/**
 * Reads the hosted visual generation state and cost evidence for a run.
 *
 * @param root - The project root containing configuration and run artifacts
 * @param run - The visual production run to summarize
 * @param rejectedCount - The number of rejected scenes available for regeneration
 * @returns The run's hosted visual generation mode, plan, quote, approval, and execution state
 */
export async function readStudioHostedVisualSummary(
  root: string,
  run: NonNullable<Awaited<ReturnType<typeof readCoreVisualRunRecord>>>,
  rejectedCount: number,
): Promise<StudioHostedVisualSummary> {
  let config;
  try {
    config = await loadConfigAtProjectRoot(root);
  } catch (error) {
    return {
      ...emptyHostedVisualSummary(),
      blockedReason: `Producer configuration is invalid: ${error instanceof Error ? error.message : String(error)}`,
      mode: "unknown",
    };
  }
  if (
    !config.providers.imageGeneration.enabled ||
    config.providers.imageGeneration.mode !== "black-forest-labs"
  ) {
    return { ...emptyHostedVisualSummary(), mode: "static-manual" };
  }
  const provider = blackForestLabsProviderSummary();
  if (!run.artifacts.includes(hostedVisualGenerationPlanPath)) {
    return {
      ...emptyHostedVisualSummary(),
      allowedPlanPurpose: allowedHostedPlanPurpose("missing", run.state, rejectedCount),
      mode: "hosted",
      provider,
    };
  }
  try {
    const persisted = await loadPersistedHostedVisualGenerationPlan(run, root);
    let lifecycle: "fresh" | "settled" = "fresh";
    let eligibleRejectedSceneIndexes: number[] = [];
    try {
      await loadHostedVisualGenerationPlan(run, config, root);
    } catch {
      const completion = await requireSettledAppliedHostedVisualPlan({
        run,
        plan: persisted,
        projectRoot: root,
      });
      eligibleRejectedSceneIndexes = completion.eligibleRejectedSceneIndexes;
      lifecycle = "settled";
    }
    const base = {
      ...emptyHostedVisualSummary(),
      allowedPlanPurpose: allowedHostedPlanPurpose(
        lifecycle,
        run.state,
        eligibleRejectedSceneIndexes.length,
      ),
      eligibleRejectedSceneIndexes,
      mode: "hosted" as const,
      provider,
      plan: {
        digest: persisted.digest,
        purpose: persisted.plan.purpose,
        sceneIndexes: persisted.plan.targetedSceneIndexes,
        status: lifecycle === "fresh" ? ("ready" as const) : ("settled" as const),
      },
    };
    if (!run.artifacts.includes("costs/estimate.json")) return base;
    const quote = await readCostEstimateAtProjectRoot(root, run);
    const stage = quote.estimate.stages.find((item) => item.stage === "imageGeneration");
    const quoteProblems = await validateCurrentCostEstimate(
      run,
      config,
      quote.estimate,
      quote.digest,
    );
    if (
      quoteProblems.length > 0 ||
      stage?.provider !== persisted.plan.provider ||
      stage.model !== persisted.plan.model ||
      stage.bindingDigest !== persisted.digest ||
      stage.bindingSummary?.kind !== "hosted-visual-generation" ||
      stage.bindingSummary.planDigest !== persisted.digest
    ) {
      return {
        ...base,
        approval: { status: "blocked" },
        blockedReason: quoteProblems[0] ?? "Hosted visual quote does not match its active plan.",
        quote: { status: "blocked" },
      };
    }
    const approval = run.approvals.find(
      (item) => item.target === "paid-generation-cost" && item.approvedRef === quote.digest,
    );
    const execution =
      lifecycle === "fresh" &&
      approval &&
      (run.state === "READY_FOR_MANUAL_PRODUCTION" || run.state === "PAID_GENERATION_COST_APPROVED")
        ? {
            approvalId: approval.approvalId,
            bindingDigest: persisted.digest,
            quoteDigest: quote.digest,
          }
        : null;
    return {
      ...base,
      approval: approval
        ? { approvalId: approval.approvalId, status: "approved" }
        : { status: "pending" },
      execution,
      quote: { digest: quote.digest, estimatedUsd: stage.estimatedUsd, status: "ready" },
    };
  } catch (error) {
    return {
      ...emptyHostedVisualSummary(),
      approval: { status: "blocked" },
      blockedReason:
        error instanceof Error ? error.message : "Hosted visual evidence could not be validated.",
      mode: "hosted",
      plan: { sceneIndexes: [], status: "blocked" },
      provider,
      quote: { status: "blocked" },
    };
  }
}

/**
 * Creates an empty hosted visual summary with no available plan, quote, approval, or execution.
 *
 * @returns A baseline summary representing unavailable hosted visual generation state
 */
export function emptyHostedVisualSummary(): StudioHostedVisualSummary {
  return {
    allowedPlanPurpose: null,
    approval: { status: "missing" },
    eligibleRejectedSceneIndexes: [],
    execution: null,
    mode: "unknown",
    provider: null,
    plan: { sceneIndexes: [], status: "missing" },
    quote: { status: "missing" },
  };
}

function blackForestLabsProviderSummary(): StudioVisualProviderSummary {
  return {
    credentialStatus: process.env.BFL_API_KEY?.trim() ? "configured" : "missing",
    kind: "hosted",
    label: "Black Forest Labs",
    modelId: "flux-2-pro",
    modelLabel: "FLUX.2 Pro",
    providerId: "black-forest-labs",
    readiness: "experimental",
  };
}

/**
 * Determines which hosted visual generation plan purpose is allowed for the current run state.
 *
 * @param lifecycle - The hosted plan lifecycle state.
 * @param state - The current run state.
 * @param eligibleRejectedCount - The number of rejected scenes eligible for regeneration.
 * @returns `"initial"` for a missing plan at the production-package stage, `"regenerate-rejected"` for a settled plan with eligible rejected scenes in an approved workflow state, or `null` otherwise.
 */
function allowedHostedPlanPurpose(
  lifecycle: "fresh" | "missing" | "settled",
  state: string,
  eligibleRejectedCount: number,
): StudioHostedVisualSummary["allowedPlanPurpose"] {
  if (lifecycle === "missing" && state === "PRODUCTION_PACKAGE_GENERATED") return "initial";
  if (
    lifecycle === "settled" &&
    eligibleRejectedCount > 0 &&
    [
      "PAID_GENERATION_COST_APPROVED",
      "PRODUCTION_PACKAGE_GENERATED",
      "READY_FOR_MANUAL_PRODUCTION",
    ].includes(state)
  ) {
    return "regenerate-rejected";
  }
  return null;
}
