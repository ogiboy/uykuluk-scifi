import path from "node:path";
import { loadConfig } from "../config/config";
import { readCostEstimate } from "../costs/costEstimate";
import { readCostReservationSummaries } from "../costs/costReservationStore";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts";
import { readLedger } from "../core/ledger";
import { loadRun, saveRun } from "../core/runStore";
import { readCostEvents } from "../costs/costLedger";
import { PromptProvenance } from "../prompts/provenance";
import { pathExists } from "../utils/fs";
import { readJsonFile } from "../utils/json";
import { bulletList } from "../utils/markdown";
import { readProductionPackageIntegrityEvidence } from "./productionPackageIntegrity";

/**
 * Generates and persists an evidence bundle for a run.
 *
 * The bundle contains run metadata, state, costs, approvals, artifacts, and prompt
 * provenance. It is written in both JSON and markdown formats.
 *
 * @param runId - The identifier of the run.
 * @returns The generated evidence bundle object.
 */
export async function generateEvidenceBundle(runId: string): Promise<unknown> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  const ledger = await readLedger(run.runId);
  const costs = await readCostEvents(run.runId);
  const costReservations = await readCostReservationSummaries(run.runId);
  const costQuote = await readCostQuoteEvidence(run);
  const productionPackageIntegrity = await readProductionPackageIntegrityEvidence(run);
  const promptProvenance = await readPromptProvenance(run.runId);
  const approvedIdea =
    run.approvedIdeaId && (await pathExists(artifactPath(run.runId, "ideas.json")))
      ? ((
          await readJsonFile<{ ideas: Array<{ id: string; title: string }> }>(
            artifactPath(run.runId, "ideas.json"),
          )
        ).ideas.find((idea) => idea.id === run.approvedIdeaId) ?? null)
      : null;
  const blockedActions = [
    !config.providers.tts.enabled ? "TTS disabled until configured and approved." : undefined,
    !config.providers.imageGeneration.enabled
      ? "Image/video generation disabled until configured and approved."
      : undefined,
    !config.providers.youtube.allowPrivateUpload
      ? "Private YouTube upload disabled by default."
      : undefined,
    !config.providers.youtube.allowPublicPublish
      ? "Public/scheduled publish disabled by default."
      : undefined,
  ].filter((item): item is string => Boolean(item));
  const bundle = {
    runId: run.runId,
    currentState: run.state,
    approvedIdea,
    scriptPath: "script.md",
    reviews: run.artifacts.filter((item) => item.startsWith("reviews/")),
    approvals: run.approvals,
    costs,
    costReservations,
    costQuote,
    productionPackageIntegrity,
    costEstimatePath: (await pathExists(artifactPath(run.runId, "costs/estimate.json")))
      ? "costs/estimate.json"
      : null,
    generatedArtifacts: run.artifacts,
    warnings: run.warnings,
    promptProvenance,
    revisions: run.artifacts.filter(
      (item) => item.startsWith("revisions/") && item.endsWith("/revision.json"),
    ),
    blockedActions,
    nextRecommendedCommand: nextCommand(run.state, costQuote),
    ledgerEventCount: ledger.length,
  };
  run = await writeRunJson(run, "evidence", "evidence_bundle.json", bundle);
  run = await writeRunText(run, "evidence", "evidence_bundle.md", renderEvidenceMarkdown(bundle));
  await saveRun(run);
  return bundle;
}

/**
 * Returns the next recommended CLI command for a given run state.
 *
 * When the state is `COST_ESTIMATED`, the recommendation depends on whether cost approval
 * is required and has already been approved.
 *
 * @param state - The current run state
 * @param costQuote - Cost quote evidence with approval information
 * @returns A command string to execute, or a fallback message if the state is unknown
 */
function nextCommand(
  state: string,
  costQuote: Awaited<ReturnType<typeof readCostQuoteEvidence>>,
): string {
  const map: Record<string, string> = {
    NEW: "pnpm producer ideas",
    IDEAS_GENERATED: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
    IDEA_APPROVED: "pnpm producer script --run <run_id>",
    SCRIPT_GENERATED: "pnpm producer review script --run <run_id>",
    SCRIPT_REVIEWED: "pnpm producer approve script --run <run_id>",
    SCRIPT_APPROVED: "pnpm producer package --run <run_id>",
    PRODUCTION_PACKAGE_GENERATED: "pnpm producer estimate --run <run_id>",
    COST_ESTIMATED:
      costQuote?.approvalRequired && !costQuote.approved
        ? "pnpm producer approve cost --run <run_id>"
        : "pnpm producer readiness --run <run_id>",
    PAID_GENERATION_COST_APPROVED: "pnpm producer readiness --run <run_id>",
    READY_FOR_MANUAL_PRODUCTION: "Manual production review. Render/upload remain approval-gated.",
  };
  return map[state] ?? "Review state and ledger before continuing.";
}

/**
 * Renders an evidence bundle as markdown.
 *
 * @returns A markdown string representation of the evidence bundle.
 */
function renderEvidenceMarkdown(bundle: unknown): string {
  const data = bundle as {
    runId: string;
    currentState: string;
    approvedIdea: { title?: string } | null;
    approvals: unknown[];
    costs: unknown[];
    costReservations: unknown[];
    costQuote: Awaited<ReturnType<typeof readCostQuoteEvidence>>;
    productionPackageIntegrity: Awaited<ReturnType<typeof readProductionPackageIntegrityEvidence>>;
    generatedArtifacts: string[];
    warnings: string[];
    promptProvenance: PromptProvenance[];
    revisions: string[];
    blockedActions: string[];
    nextRecommendedCommand: string;
  };
  return [
    "# Evidence Bundle",
    "",
    `Run: ${data.runId}`,
    `Current state: ${data.currentState}`,
    `Approved idea: ${data.approvedIdea?.title ?? "None"}`,
    "",
    "## Approvals",
    "",
    bulletList(data.approvals.map((approval) => JSON.stringify(approval))),
    "",
    "## Costs",
    "",
    bulletList(data.costs.map((cost) => JSON.stringify(cost))),
    "",
    "## Cost Reservations",
    "",
    bulletList(data.costReservations.map((reservation) => JSON.stringify(reservation))),
    "",
    "## Cost Quote",
    "",
    data.costQuote ? JSON.stringify(data.costQuote) : "None",
    "",
    "## Production Package Integrity",
    "",
    data.productionPackageIntegrity
      ? JSON.stringify(data.productionPackageIntegrity)
      : "No production package manifest.",
    "",
    "## Warnings",
    "",
    bulletList(data.warnings),
    "",
    "## Prompt Provenance",
    "",
    bulletList(
      data.promptProvenance.map(
        (prompt) =>
          `${prompt.key}: ${prompt.hash} from ${prompt.source ?? "legacy-inline"} -> ${path.posix.normalize(prompt.artifact)}`,
      ),
    ),
    "",
    "## Revisions",
    "",
    bulletList(data.revisions.map((revision) => path.posix.normalize(revision))),
    "",
    "## Artifacts",
    "",
    bulletList(data.generatedArtifacts.map((artifact) => path.posix.normalize(artifact))),
    "",
    "## Blocked Actions",
    "",
    bulletList(data.blockedActions),
    "",
    "## Next Recommended Command",
    "",
    data.nextRecommendedCommand,
  ].join("\n");
}

/**
 * Reads cost estimate evidence for a run, including approval status.
 *
 * @returns An object with cost estimate details and approval status, or `null` if the estimate file does not exist or cannot be read.
 */
async function readCostQuoteEvidence(run: Awaited<ReturnType<typeof loadRun>>): Promise<{
  path: string;
  digest: string;
  estimatedUsd: number;
  currency: "USD";
  approvalRequired: boolean;
  approved: boolean;
  approvalId: string | null;
} | null> {
  const relativePath = "costs/estimate.json";
  if (!(await pathExists(artifactPath(run.runId, relativePath)))) {
    return null;
  }
  try {
    const { estimate, digest } = await readCostEstimate(run.runId);
    const approval = run.approvals.find(
      (item) =>
        item.runId === run.runId &&
        item.target === "paid-generation-cost" &&
        item.approvedRef === digest,
    );
    return {
      path: relativePath,
      digest,
      estimatedUsd: estimate.estimatedStageCost,
      currency: estimate.currency,
      approvalRequired: estimate.approvalRequired,
      approved: Boolean(approval),
      approvalId: approval?.approvalId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Collects prompt provenance records from a run's artifacts.
 *
 * @param runId - The run identifier
 * @returns An array of prompt provenance records found in the run's artifacts
 */
async function readPromptProvenance(runId: string): Promise<PromptProvenance[]> {
  const sources = ["ideas.json", "script.meta.json", "production/production_package.meta.json"];
  const records: PromptProvenance[] = [];
  for (const relativePath of sources) {
    const target = artifactPath(runId, relativePath);
    if (!(await pathExists(target))) {
      continue;
    }
    const value = await readJsonFile<{ prompt?: PromptProvenance }>(target);
    if (value.prompt) {
      records.push(value.prompt);
    }
  }
  return records;
}
