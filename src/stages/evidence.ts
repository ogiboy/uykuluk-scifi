import path from "node:path";
import { loadConfig } from "../config/config";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts";
import { readLedger } from "../core/ledger";
import { loadRun, saveRun } from "../core/runStore";
import { readCostEvents } from "../costs/costLedger";
import { PromptProvenance } from "../prompts/provenance";
import { pathExists } from "../utils/fs";
import { readJsonFile } from "../utils/json";
import { bulletList } from "../utils/markdown";

export async function generateEvidenceBundle(runId: string): Promise<unknown> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  const ledger = await readLedger(run.runId);
  const costs = await readCostEvents(run.runId);
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
    nextRecommendedCommand: nextCommand(run.state),
    ledgerEventCount: ledger.length,
  };
  run = await writeRunJson(run, "evidence", "evidence_bundle.json", bundle);
  run = await writeRunText(run, "evidence", "evidence_bundle.md", renderEvidenceMarkdown(bundle));
  await saveRun(run);
  return bundle;
}

function nextCommand(state: string): string {
  const map: Record<string, string> = {
    NEW: "pnpm producer ideas",
    IDEAS_GENERATED: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
    IDEA_APPROVED: "pnpm producer script --run <run_id>",
    SCRIPT_GENERATED: "pnpm producer review script --run <run_id>",
    SCRIPT_REVIEWED: "pnpm producer approve script --run <run_id>",
    SCRIPT_APPROVED: "pnpm producer package --run <run_id>",
    PRODUCTION_PACKAGE_GENERATED: "pnpm producer estimate --run <run_id>",
    COST_ESTIMATED: "pnpm producer readiness --run <run_id>",
    READY_FOR_MANUAL_PRODUCTION: "Manual production review. Render/upload remain approval-gated.",
  };
  return map[state] ?? "Review state and ledger before continuing.";
}

function renderEvidenceMarkdown(bundle: unknown): string {
  const data = bundle as {
    runId: string;
    currentState: string;
    approvedIdea: { title?: string } | null;
    approvals: unknown[];
    costs: unknown[];
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
