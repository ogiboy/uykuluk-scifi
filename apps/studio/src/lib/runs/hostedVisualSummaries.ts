import { loadConfigAtProjectRoot } from "../../../../../src/config/config";
import {
  readCostEstimateAtProjectRoot,
  validateCurrentCostEstimate,
} from "../../../../../src/costs/costEstimate";
import { hostedVisualGenerationPlanPath } from "../../../../../src/stages/visuals/visualGenerationPlanContracts";
import { loadHostedVisualGenerationPlan } from "../../../../../src/stages/visuals/visualGenerationPlanStore";
import type { readCoreVisualRunRecord } from "./visualRunRecord";

export type StudioHostedVisualSummary = Readonly<{
  approval: Readonly<{
    approvalId?: string;
    status: "approved" | "blocked" | "missing" | "pending";
  }>;
  execution: Readonly<{ approvalId: string; bindingDigest: string; quoteDigest: string }> | null;
  blockedReason?: string;
  mode: "black-forest-labs" | "static-manual" | "unknown";
  allowedPlanPurpose: "initial" | "regenerate-rejected" | null;
  plan: Readonly<{
    digest?: string;
    purpose?: "initial" | "regenerate-rejected";
    sceneIndexes: readonly number[];
    status: "blocked" | "missing" | "ready";
  }>;
  quote: Readonly<{
    digest?: string;
    estimatedUsd?: number;
    status: "blocked" | "missing" | "ready";
  }>;
}>;

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
  if (!run.artifacts.includes(hostedVisualGenerationPlanPath)) {
    return {
      ...emptyHostedVisualSummary(),
      allowedPlanPurpose: allowedHostedPlanPurpose(run.state, rejectedCount),
      mode: "black-forest-labs",
    };
  }
  try {
    const loaded = await loadHostedVisualGenerationPlan(run, config, root);
    const base = {
      ...emptyHostedVisualSummary(),
      allowedPlanPurpose: allowedHostedPlanPurpose(run.state, rejectedCount),
      mode: "black-forest-labs" as const,
      plan: {
        digest: loaded.digest,
        purpose: loaded.plan.purpose,
        sceneIndexes: loaded.plan.targetedSceneIndexes,
        status: "ready" as const,
      },
    };
    if (!run.artifacts.includes("costs/estimate.json")) return base;
    const quote = await readCostEstimateAtProjectRoot(root, run.runId);
    const stage = quote.estimate.stages.find((item) => item.stage === "imageGeneration");
    const quoteProblems = await validateCurrentCostEstimate(
      run,
      config,
      quote.estimate,
      quote.digest,
    );
    if (
      quoteProblems.length > 0 ||
      stage?.provider !== loaded.plan.provider ||
      stage.model !== loaded.plan.model ||
      stage.bindingDigest !== loaded.digest ||
      stage.bindingSummary?.kind !== "hosted-visual-generation" ||
      stage.bindingSummary.planDigest !== loaded.digest
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
      approval &&
      (run.state === "READY_FOR_MANUAL_PRODUCTION" || run.state === "PAID_GENERATION_COST_APPROVED")
        ? {
            approvalId: approval.approvalId,
            bindingDigest: loaded.digest,
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
      mode: "black-forest-labs",
      plan: { sceneIndexes: [], status: "blocked" },
      quote: { status: "blocked" },
    };
  }
}

export function emptyHostedVisualSummary(): StudioHostedVisualSummary {
  return {
    allowedPlanPurpose: null,
    approval: { status: "missing" },
    execution: null,
    mode: "unknown",
    plan: { sceneIndexes: [], status: "missing" },
    quote: { status: "missing" },
  };
}

function allowedHostedPlanPurpose(
  state: string,
  rejectedCount: number,
): StudioHostedVisualSummary["allowedPlanPurpose"] {
  if (state === "PRODUCTION_PACKAGE_GENERATED") return "initial";
  if (
    rejectedCount > 0 &&
    (state === "PAID_GENERATION_COST_APPROVED" || state === "READY_FOR_MANUAL_PRODUCTION")
  ) {
    return "regenerate-rejected";
  }
  return null;
}
