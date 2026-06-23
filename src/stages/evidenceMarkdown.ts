import path from "node:path";
import type { PromptProvenance } from "../prompts/provenance.js";
import { bulletList } from "../utils/markdown.js";
import type { readCostQuoteEvidence } from "./evidence.js";
import type { readProductionPackageIntegrityEvidence } from "./productionPackageIntegrity.js";
import type { readDraftRenderEvidence } from "./renderEvidence.js";
import type { readRenderPlanEvidence } from "./renderPlan.js";
import type { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";

export function renderEvidenceMarkdown(bundle: unknown): string {
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
    renderPlan: Awaited<ReturnType<typeof readRenderPlanEvidence>>;
    voiceoverAudio: Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>;
    draftRender: Awaited<ReturnType<typeof readDraftRenderEvidence>>;
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
    "## Render Plan",
    "",
    JSON.stringify(data.renderPlan),
    "",
    "## Voiceover Audio",
    "",
    JSON.stringify(data.voiceoverAudio),
    "",
    "## Draft Render",
    "",
    JSON.stringify(data.draftRender),
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
