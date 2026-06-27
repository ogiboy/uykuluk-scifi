import path from "node:path";
import type { PromptProvenance } from "../prompts/provenance.js";
import { bulletList } from "../utils/markdown.js";
import type { readCostQuoteEvidence } from "./evidence.js";
import { materializeRunCommand } from "./evidenceNextCommand.js";
import type { readProductionPackageIntegrityEvidence } from "./productionPackageIntegrity.js";
import type { readDraftRenderEvidence } from "./renderEvidence.js";
import type { readRenderPlanEvidence } from "./renderPlan.js";
import type { readVoiceoverAudioEvidence } from "./voiceoverEvidence.js";

export type EvidenceMarkdownBundle = {
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

/**
 * Renders an evidence bundle as Markdown.
 *
 * @param data - The evidence bundle to format.
 * @returns The rendered Markdown report.
 */
export function renderEvidenceMarkdown(data: EvidenceMarkdownBundle): string {
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
    "## Production Media Summary",
    "",
    bulletList(productionMediaSummary(data.renderPlan, data.voiceoverAudio, data.draftRender)),
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
    materializeRunCommand(data.nextRecommendedCommand, data.runId),
  ].join("\n");
}

/**
 * Builds summary strings for the render plan, voiceover audio, and draft render evidence.
 *
 * @param renderPlan - Parsed render plan evidence
 * @param voiceoverAudio - Parsed voiceover audio evidence
 * @param draftRender - Parsed draft render evidence
 * @returns Three summary strings, one for each evidence object
 */
function productionMediaSummary(
  renderPlan: Awaited<ReturnType<typeof readRenderPlanEvidence>>,
  voiceoverAudio: Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>,
  draftRender: Awaited<ReturnType<typeof readDraftRenderEvidence>>,
): string[] {
  return [
    renderPlanSummary(renderPlan),
    voiceoverAudioSummary(voiceoverAudio),
    draftRenderSummary(draftRender),
  ];
}

/**
 * Summarizes the render plan evidence.
 *
 * @returns A status-specific summary of the render plan evidence, including asset and artifact counts for a passing plan, the blocking message for a blocked plan, or the required artifacts for missing evidence.
 */
function renderPlanSummary(renderPlan: Awaited<ReturnType<typeof readRenderPlanEvidence>>): string {
  if (renderPlan.status === "pass") {
    return `Render plan: pass (${renderPlan.assetCount} assets, ${renderPlan.artifactCount} artifacts, ${renderPlan.path}).`;
  }
  if (renderPlan.status === "block") {
    return `Render plan: block (${renderPlan.message}).`;
  }
  return `Render plan: missing (${renderPlan.requiredArtifacts.join(", ")}).`;
}

/**
 * Summarizes the voiceover audio evidence.
 *
 * @param voiceoverAudio - The voiceover audio evidence to summarize
 * @returns A status-based summary of the voiceover audio evidence
 */
function voiceoverAudioSummary(
  voiceoverAudio: Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>,
): string {
  if (voiceoverAudio.status === "pass") {
    return `Voiceover audio: pass (${Math.round(voiceoverAudio.durationSeconds)}s, ${voiceoverQualitySummary(voiceoverAudio)}, ${voiceoverAudio.sourceWordCount} source words).`;
  }
  if (voiceoverAudio.status === "block") {
    return `Voiceover audio: block (${voiceoverAudio.message}).`;
  }
  return `Voiceover audio: missing (${voiceoverAudio.requiredArtifacts.join(", ")}).`;
}

/**
 * Summarizes the voiceover quality evidence.
 *
 * @param voiceoverAudio - The passed voiceover audio evidence
 * @returns A short description of the voiceover mode and whether it includes a production voice candidate
 */
function voiceoverQualitySummary(
  voiceoverAudio: Extract<
    Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>,
    { status: "pass" }
  >,
): string {
  if (voiceoverAudio.productionVoiceCandidate) {
    return `${voiceoverAudio.mode}, production voice candidate, operator listening still required`;
  }
  return `${voiceoverAudio.mode}, timing/reference only`;
}

/**
 * Summarizes the draft render evidence.
 *
 * @param draftRender - The draft render evidence record
 * @returns A status summary for the draft render evidence
 */
function draftRenderSummary(
  draftRender: Awaited<ReturnType<typeof readDraftRenderEvidence>>,
): string {
  if (draftRender.status === "pass") {
    return `Draft render: pass (${Math.round(draftRender.durationSeconds)}s, ${draftRender.timelineSegments.join(" -> ")}${sourceFrameSummary(draftRender)}${draftRenderVoiceoverSummary(draftRender)}${mediaProbeSummary(draftRender.mediaProbe)}).`;
  }
  if (draftRender.status === "block") {
    return `Draft render: block (${draftRender.message}).`;
  }
  return `Draft render: missing (${draftRender.requiredArtifacts.join(", ")}).`;
}

/**
 * Summarizes the voiceover details for a passed draft render.
 *
 * @param draftRender - The draft render evidence with pass status
 * @returns A voiceover summary fragment for the draft render
 */
function draftRenderVoiceoverSummary(
  draftRender: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  if (draftRender.voiceoverProductionVoiceCandidate) {
    return `, voiceover ${draftRender.voiceoverMode} production voice candidate`;
  }
  return `, voiceover ${draftRender.voiceoverMode} timing/reference only`;
}

/**
 * Summarizes the source frame segments in a draft render.
 *
 * @param draftRender - Passed draft render evidence
 * @returns A source frame summary when segments are available, or an empty string otherwise
 */
function sourceFrameSummary(
  draftRender: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  if (
    draftRender.sourceFrameCount === 0 ||
    !Array.isArray(draftRender.sourceFrameSegments) ||
    draftRender.sourceFrameSegments.length === 0
  ) {
    return "";
  }
  return `, source frames ${draftRender.sourceFrameSegments.join("/")}`;
}

/**
 * Summarizes the media probe dimensions for a draft render.
 *
 * @param mediaProbe - The media probe data for a passed draft render.
 * @returns A summary string with the probed video dimensions, or an empty string when no probe is available.
 */
function mediaProbeSummary(
  mediaProbe: Extract<
    Awaited<ReturnType<typeof readDraftRenderEvidence>>,
    { status: "pass" }
  >["mediaProbe"],
): string {
  if (!mediaProbe) {
    return "";
  }
  return `, ffprobe ${mediaProbe.video.width}x${mediaProbe.video.height} audio`;
}
