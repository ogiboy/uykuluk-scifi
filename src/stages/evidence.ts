import { loadConfig } from "../config/config.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { readLedger } from "../core/ledger.js";
import { loadRun, saveRun } from "../core/runStore.js";
import { readCostEstimate } from "../costs/costEstimate.js";
import { readCostEvents } from "../costs/costLedger.js";
import {
  isActiveCostReservation,
  readCostReservationSummaries,
} from "../costs/costReservationStore.js";
import { PromptProvenance } from "../prompts/provenance.js";
import { pathExists } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import { evidenceBlockedActions } from "./evidence/evidenceBlockedActions.js";
import { renderEvidenceMarkdown } from "./evidence/evidenceMarkdown.js";
import { evidenceNextCommand, materializeRunCommand } from "./evidence/evidenceNextCommand.js";
import { readProductionPackageIntegrityEvidence } from "./production/productionPackageIntegrity.js";
import { readDraftRenderEvidence } from "./renderEvidence.js";
import { readRenderPlanEvidence } from "./renderPlan.js";
import { readScriptReviewEvidence } from "./script/scriptReviewEvidence.js";
import {
  ttsConfigurationDigest,
  voiceAuditionArtifactRevision,
  voiceAuditionPathRevision,
} from "./voice/catalog/voiceAuditionRevision.js";
import { maximumVoiceCatalogAgeMs } from "./voice/catalog/voiceCatalogStore.js";
import { readCurrentVoiceSelection } from "./voice/catalog/voiceSelectionStore.js";
import { readVoiceoverAudioEvidence } from "./voice/voiceoverEvidence.js";

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
  const renderPlan = await readRenderPlanEvidence(run);
  const voiceoverAudio = await readVoiceoverAudioEvidence(run);
  const draftRender = await readDraftRenderEvidence(run);
  const scriptReview = await readScriptReviewEvidence(run);
  const promptProvenance = await readPromptProvenance(run.runId);
  const voiceSelection = await readVoiceSelectionEvidence(run.runId, config);
  const voiceAuditionPathRevisionDigest = voiceAuditionPathRevision(run.artifacts);
  const currentTtsConfigurationDigest = ttsConfigurationDigest(config.providers.tts);
  const voiceAuditionRevision =
    voiceSelection.status === "current"
      ? await voiceAuditionArtifactRevision(run, Object.values(voiceSelection.artifacts))
      : null;
  const unresolvedCostReservations = costReservations.filter(isActiveCostReservation);
  const approvedIdea =
    run.approvedIdeaId && (await pathExists(artifactPath(run.runId, "ideas.json")))
      ? ((
          await readJsonFile<{ ideas: Array<{ id: string; title: string }> }>(
            artifactPath(run.runId, "ideas.json"),
          )
        ).ideas.find((idea) => idea.id === run.approvedIdeaId) ?? null)
      : null;
  const blockedActions = evidenceBlockedActions(
    config,
    renderPlan,
    voiceoverAudio,
    draftRender,
    unresolvedCostReservations.length,
  );
  const bundle = {
    schemaVersion: 1,
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
    renderPlan,
    voiceoverAudio,
    voiceSelection,
    voiceAuditionPathRevision: voiceAuditionPathRevisionDigest,
    voiceAuditionRevision,
    ttsConfigurationDigest: currentTtsConfigurationDigest,
    draftRender,
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
    nextRecommendedCommand: materializeRunCommand(
      evidenceNextCommand({
        costQuote,
        draftRender,
        hasUnresolvedCostReservation: unresolvedCostReservations.length > 0,
        renderPlan,
        scriptReview,
        state: run.state,
        ttsEnabled: config.providers.tts.enabled,
        ttsMode: config.providers.tts.mode,
        voiceSelection,
        voiceoverAudio,
      }),
      run.runId,
    ),
    ledgerEventCount: ledger.length,
  };
  run = await writeRunJson(run, "evidence", "evidence_bundle.json", bundle);
  run = await writeRunText(run, "evidence", "evidence_bundle.md", renderEvidenceMarkdown(bundle));
  await saveRun(run);
  return bundle;
}

async function readVoiceSelectionEvidence(
  runId: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<
  | { status: "not-required" }
  | { status: "missing-or-invalid" }
  | {
      status: "current";
      path: string;
      digest: string;
      validUntil: string;
      artifacts: {
        catalog: string;
        previewEvidence: string;
        previewAudio: string;
        selection: string;
      };
    }
> {
  if (!config.providers.tts.enabled || config.providers.tts.mode !== "elevenlabs") {
    return { status: "not-required" };
  }
  try {
    const current = await readCurrentVoiceSelection(runId, { config });
    return {
      status: "current",
      path: current.selectionPath,
      digest: current.selection.selectionDigest,
      validUntil: new Date(
        Date.parse(current.catalog.fetchedAt) + maximumVoiceCatalogAgeMs,
      ).toISOString(),
      artifacts: {
        catalog: current.catalogPath,
        previewEvidence: current.previewPath,
        previewAudio: current.preview.output.path,
        selection: current.selectionPath,
      },
    };
  } catch (error) {
    if (error instanceof SafeExitError) {
      return { status: "missing-or-invalid" };
    }
    throw error;
  }
}

/** Reads quote evidence, preserving parse failures as explicit invalid status. */
export async function readCostQuoteEvidence(
  run: Awaited<ReturnType<typeof loadRun>>,
): Promise<{
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
