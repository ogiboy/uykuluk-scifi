import { renderPlanArtifactPaths } from "../../../../../src/stages/render/renderPlanSchemas";
import type { StudioArtifactPreview } from "../artifacts/artifactPreviews";
import type { StudioRunDetail } from "../runSummaries";
import {
  stageActionForRun,
  studioStageActionConfig,
  type StudioStageActionConfig,
  type StudioStageActionId,
} from "./studioStageAction";

export type StudioRenderPlanReviewActionRun = Pick<
  StudioRunDetail,
  "nextRecommendedCommand" | "runId" | "state"
> &
  Readonly<{ artifacts: readonly Pick<StudioArtifactPreview, "exists" | "path">[] }>;

export type StudioArtifactReviewAction = StudioStageActionConfig &
  Readonly<{ command: string; details: string; eyebrow: string }>;

type ArtifactReviewDefinition = Readonly<{
  actionId: Extract<StudioStageActionId, "render.review" | "render-plan.review" | "voice.review">;
  artifactPaths: readonly string[];
  command: (runId: string) => string;
  details: string;
  eyebrow: string;
}>;

const artifactReviewDefinitions = [
  {
    actionId: "render-plan.review",
    artifactPaths: renderPlanArtifactPaths,
    command: renderPlanReviewCommand,
    details:
      "Review the storyboard contact sheet, scene timing, bookends, and asset provenance before treating the render plan as operator-ready for estimate, voiceover, or render approval.",
    eyebrow: "Visual review",
  },
  {
    actionId: "voice.review",
    artifactPaths: [
      "production/audio/voiceover.wav",
      "production/audio/voiceover.meta.json",
      "production/audio/voiceover_review.md",
    ],
    command: voiceoverReviewCommand,
    details:
      "Listen to the generated local voiceover and inspect the review artifact before render approval. Deterministic reference audio remains timing-only unless evidence says it is a production voice candidate.",
    eyebrow: "Audio review",
  },
  {
    actionId: "render.review",
    artifactPaths: [
      "production/render/draft.mp4",
      "production/render/render_manifest.json",
      "production/render/draft_review.md",
    ],
    command: draftRenderReviewCommand,
    details:
      "Review the local MP4 draft and manifest evidence before recording any local render decision. Upload and publish remain unavailable from this action.",
    eyebrow: "Draft review",
  },
] as const satisfies readonly ArtifactReviewDefinition[];

/**
 * Surfaces the render-plan review handoff whenever the generated review artifacts exist.
 *
 * The review command is read-only: it opens the contact-sheet/render-plan handoff and does not
 * advance state, approve cost, create voiceover, render media, upload, or publish. Studio keeps it
 * visible even when the next state-progressing action is estimate/evidence/readiness so operators
 * do not skip the visual contact-sheet review.
 *
 * @param run - The Studio run detail projection with artifact previews.
 * @returns The guarded render-plan review action, or `null` when artifacts are incomplete.
 */
export function renderPlanReviewActionForRun(
  run: StudioRenderPlanReviewActionRun,
): StudioArtifactReviewAction | null {
  return artifactReviewActionForDefinition(run, artifactReviewDefinitions[0]);
}

/**
 * Finds all artifact-backed read-only review actions that should stay visible in Studio.
 *
 * @param run - The Studio run detail projection with artifact previews.
 * @returns Review actions for complete local artifact handoffs not already shown as stage actions.
 */
export function artifactReviewActionsForRun(
  run: StudioRenderPlanReviewActionRun,
): StudioArtifactReviewAction[] {
  return artifactReviewDefinitions
    .map((definition) => artifactReviewActionForDefinition(run, definition))
    .filter((action): action is StudioArtifactReviewAction => Boolean(action));
}

/**
 * Materializes the CLI-equivalent render-plan review command for display and confirmation.
 *
 * @param runId - The run identifier used by the local review command.
 * @returns A copy-pasteable producer command.
 */
export function renderPlanReviewCommand(runId: string): string {
  return `pnpm producer review render-plan --run ${runId}`;
}

/**
 * Materializes the CLI-equivalent voiceover review command for display and confirmation.
 *
 * @param runId - The run identifier used by the local review command.
 * @returns A copy-pasteable producer command.
 */
export function voiceoverReviewCommand(runId: string): string {
  return `pnpm producer review voice --run ${runId}`;
}

/**
 * Materializes the CLI-equivalent draft-render review command for display and confirmation.
 *
 * @param runId - The run identifier used by the local review command.
 * @returns A copy-pasteable producer command.
 */
export function draftRenderReviewCommand(runId: string): string {
  return `pnpm producer review render --run ${runId}`;
}

function artifactReviewActionForDefinition(
  run: StudioRenderPlanReviewActionRun,
  definition: ArtifactReviewDefinition,
): StudioArtifactReviewAction | null {
  const recommendedStageAction = stageActionForRun(run);
  if (recommendedStageAction?.actionId === definition.actionId) {
    return null;
  }
  if (!hasCompleteReviewArtifacts(run.artifacts, definition.artifactPaths)) {
    return null;
  }
  const config = studioStageActionConfig(definition.actionId);
  return config
    ? {
        ...config,
        command: definition.command(run.runId),
        details: definition.details,
        eyebrow: definition.eyebrow,
      }
    : null;
}

function hasCompleteReviewArtifacts(
  artifacts: readonly Pick<StudioArtifactPreview, "exists" | "path">[],
  artifactPaths: readonly string[],
): boolean {
  return artifactPaths.every((artifactPath) =>
    artifacts.some((artifact) => artifact.path === artifactPath && artifact.exists),
  );
}
