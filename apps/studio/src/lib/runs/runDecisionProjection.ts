import {
  renderDecisionCommandTemplates,
  renderDecisionJsonPath,
  type RenderDecisionCommandTemplate,
} from "../../../../../src/stages/render/renderDecisionCommands";
import { renderPlanArtifactPaths } from "../../../../../src/stages/render/renderPlanSchemas";
import type { StatusWorkflowStep } from "../../../../../src/stages/status/statusWorkflow";
import { buildStatusWorkflowProgress } from "../../../../../src/stages/status/statusWorkflow";
import type { StudioChannelHandoffDecisionSummary } from "./channelHandoffDecisionSummaries";
import type { StudioChannelHandoffSummary } from "./channelHandoffSummaries";
import { evidenceNextRecommendedCommand, type StudioEvidenceSummary } from "./evidenceSummaries";
import type { StudioFinalReviewBundleSummary } from "./finalReviewBundleSummaries";
import type { StudioRenderDecisionSummary } from "./renderDecisionSummaries";
import type { RunRecord, StudioRunState } from "./runRecordTypes";

export type StudioNextRecommendedCommandInput = Readonly<{
  artifacts: readonly string[];
  channelHandoff: StudioChannelHandoffSummary;
  channelHandoffDecision: StudioChannelHandoffDecisionSummary;
  evidence: StudioEvidenceSummary;
  finalReviewBundle: StudioFinalReviewBundleSummary;
  renderDecision: StudioRenderDecisionSummary;
  runId: string;
  state: string;
}>;

/**
 * Builds the read-only workflow progress projection for a Studio run.
 *
 * @param input - The Studio summary inputs used for workflow projection.
 * @returns Ordered v1 workflow progress rows.
 */
export function studioWorkflowProgress(input: {
  channelHandoff: StudioChannelHandoffSummary;
  finalReviewBundle: StudioFinalReviewBundleSummary;
  mediaArtifacts: Parameters<typeof buildStatusWorkflowProgress>[0]["mediaArtifacts"];
  readinessStatus: Parameters<typeof buildStatusWorkflowProgress>[0]["readinessStatus"];
  renderDecision: StudioRenderDecisionSummary;
  state: StudioRunState;
}): StatusWorkflowStep[] {
  return buildStatusWorkflowProgress({
    channelHandoff: studioWorkflowArtifactStatus(input.channelHandoff),
    finalReviewBundle: studioWorkflowArtifactStatus(input.finalReviewBundle),
    mediaArtifacts: input.mediaArtifacts,
    readinessStatus: input.readinessStatus,
    renderDecision: studioWorkflowRenderDecision(input.renderDecision),
    state: input.state,
  });
}

/**
 * Chooses the Studio next safe action while honoring durable render decisions.
 *
 * @param input - Current evidence, decisions, artifacts, and run identity.
 * @returns A command or operator action for the next safe step.
 */
export function studioNextRecommendedCommand(
  input: StudioNextRecommendedCommandInput,
): string | null {
  const {
    artifacts,
    channelHandoff,
    channelHandoffDecision,
    evidence,
    finalReviewBundle,
    renderDecision,
    runId,
    state,
  } = input;
  if (finalReviewBundle.kind === "invalid" || finalReviewBundle.kind === "stale") {
    return finalReviewBundle.nextAction;
  }
  if (finalReviewBundle.kind === "present") {
    if (channelHandoff.kind === "present") {
      return channelHandoffDecision.nextAction ?? channelHandoff.nextAction;
    }
    if (channelHandoff.kind === "invalid" || channelHandoff.kind === "stale") {
      return channelHandoff.nextAction;
    }
    return finalReviewBundle.nextAction;
  }
  if (finalReviewBundle.kind === "missing" && renderDecision.kind === "present") {
    return finalReviewBundle.nextAction;
  }
  if (renderDecision.kind === "present") {
    return renderDecision.nextAction;
  }
  if (renderDecision.kind === "invalid" || renderDecision.kind === "stale") {
    return renderDecision.nextAction;
  }
  const packageAction = productionPackageActionWhenEvidenceCannotLead(
    evidence,
    state,
    runId,
    artifacts,
  );
  if (packageAction) {
    return packageAction;
  }
  return evidenceNextRecommendedCommand(evidence, state, runId);
}

/**
 * Builds local render-decision command templates for runs that still need a decision.
 *
 * @param record - The run record.
 * @param evidence - The current evidence summary.
 * @param renderDecision - The current render decision summary.
 * @returns Copy-pasteable CLI command templates for Studio display.
 */
export function studioRenderDecisionCommands(
  record: RunRecord,
  evidence: StudioEvidenceSummary,
  renderDecision: StudioRenderDecisionSummary,
): RenderDecisionCommandTemplate[] {
  const runId = record.runId;
  if (
    !runId ||
    record.state !== "RENDERED" ||
    evidence.status !== "available" ||
    renderDecision.kind !== "missing"
  ) {
    return [];
  }
  if (record.artifacts?.includes(renderDecisionJsonPath)) {
    return [];
  }
  return evidence.snapshot?.draftRender?.status === "pass"
    ? renderDecisionCommandTemplates(runId)
    : [];
}

function studioWorkflowRenderDecision(
  renderDecision: StudioRenderDecisionSummary,
): Parameters<typeof buildStatusWorkflowProgress>[0]["renderDecision"] {
  if (renderDecision.kind === "present") {
    return { kind: "present", message: renderDecision.message };
  }
  if (renderDecision.kind === "invalid" || renderDecision.kind === "stale") {
    return { kind: renderDecision.kind, message: renderDecision.message };
  }
  return { kind: "missing" };
}

function studioWorkflowArtifactStatus(
  artifact: StudioChannelHandoffSummary | StudioFinalReviewBundleSummary,
): Parameters<typeof buildStatusWorkflowProgress>[0]["finalReviewBundle"] {
  if (artifact.kind === "present") {
    return {
      kind: "present",
      message: artifact.message,
      status: "bundle" in artifact ? artifact.bundle.status : artifact.handoff.status,
    };
  }
  if (artifact.kind === "invalid" || artifact.kind === "stale") {
    return { kind: artifact.kind, message: artifact.message };
  }
  return { kind: "missing" };
}

function productionPackageActionWhenEvidenceCannotLead(
  evidence: StudioEvidenceSummary,
  state: string,
  runId: string,
  artifacts: readonly string[],
): string | null {
  if (state !== "PRODUCTION_PACKAGE_GENERATED" || evidence.status === "available") {
    return null;
  }
  const evidenceUnavailableBecauseItIsUnsafe =
    evidence.status === "invalid" || evidence.status === "stale";
  const nextCommand =
    evidenceUnavailableBecauseItIsUnsafe || hasCompleteRenderPlanArtifacts(artifacts)
      ? "pnpm producer evidence --run <run_id>"
      : "pnpm producer render-plan --run <run_id>";
  return nextCommand.replaceAll("<run_id>", runId);
}

function hasCompleteRenderPlanArtifacts(artifacts: readonly string[]): boolean {
  return renderPlanArtifactPaths.every((artifactPath) => artifacts.includes(artifactPath));
}
