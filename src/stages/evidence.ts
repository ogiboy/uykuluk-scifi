import path from "node:path";
import { loadConfig } from "../config/config.js";
import { readCostEstimate } from "../costs/costEstimate.js";
import {
  isActiveCostReservation,
  readCostReservationSummaries,
} from "../costs/costReservationStore.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { readLedger } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { readCostEvents } from "../costs/costLedger.js";
import { PromptProvenance } from "../prompts/provenance.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { bulletList } from "../utils/markdown.js";
import { nowIso } from "../utils/time.js";
import { evidenceNextCommand } from "./evidenceNextCommand.js";
import { readProductionPackageIntegrityEvidence } from "./productionPackageIntegrity.js";
import { readScriptReviewEvidence } from "./scriptReviewEvidence.js";

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
  const scriptReview = await readScriptReviewEvidence(run);
  const promptProvenance = await readPromptProvenance(run.runId);
  const unresolvedCostReservations = costReservations.filter(isActiveCostReservation);
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
    unresolvedCostReservations.length > 0
      ? `${unresolvedCostReservations.length} cost reservation outcome(s) remain active or uncertain; internal reconciliation is required.`
      : undefined,
  ].filter((item): item is string => Boolean(item));
  const bundle = {
    runId: run.runId,
    generatedAt: nowIso(),
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
    nextRecommendedCommand: evidenceNextCommand(
      run.state,
      costQuote,
      unresolvedCostReservations.length > 0,
      scriptReview,
    ),
    ledgerEventCount: ledger.length,
  };
  run = await writeRunJson(run, "evidence", "evidence_bundle.json", bundle);
  run = await writeRunText(run, "evidence", "evidence_bundle.md", renderEvidenceMarkdown(bundle));
  await saveRun(run);
  return bundle;
}

/** Renders the persisted evidence bundle for operator review. */
function renderEvidenceMarkdown(bundle: unknown): string {
  const data = bundle as {
    runId: string;
    generatedAt: string;
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
    `Generated at: ${data.generatedAt}`,
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

/** Reads quote evidence, preserving parse failures as explicit invalid status. */
async function readCostQuoteEvidence(run: Awaited<ReturnType<typeof loadRun>>): Promise<{
  path: string;
  digest: string;
  estimatedUsd: number;
  currency: "USD";
  approvalRequired: boolean;
  approved: boolean;
  approvalId: string | null;
  invalid?: boolean;
  invalidReason?: string;
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
  } catch (error) {
    return {
      path: relativePath,
      digest: "invalid",
      estimatedUsd: 0,
      currency: "USD",
      approvalRequired: false,
      approved: false,
      approvalId: null,
      invalid: true,
      invalidReason: (error as Error).message,
    };
  }
}

/** Collects prompt provenance from generated run artifacts. */
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
