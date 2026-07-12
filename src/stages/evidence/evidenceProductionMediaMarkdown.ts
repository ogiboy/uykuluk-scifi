import type { readDraftRenderEvidence } from "../renderEvidence.js";
import type { readRenderPlanEvidence } from "../renderPlan.js";
import { productionMediaReviewAction } from "../status/statusMediaReview.js";
import { productionMediaStatus } from "../status/statusMediaSummary.js";
import type { readVoiceoverAudioEvidence } from "../voice/voiceoverEvidence.js";

/**
 * Builds summary strings for the render plan, voiceover audio, and draft render evidence.
 *
 * @param renderPlan - Parsed render plan evidence
 * @param voiceoverAudio - Parsed voiceover audio evidence
 * @param draftRender - Parsed draft render evidence
 * @returns Three summary strings, one for each evidence object
 */
export function productionMediaSummary(
  runId: string,
  renderPlan: Awaited<ReturnType<typeof readRenderPlanEvidence>>,
  voiceoverAudio: Awaited<ReturnType<typeof readVoiceoverAudioEvidence>>,
  draftRender: Awaited<ReturnType<typeof readDraftRenderEvidence>>,
): string[] {
  const summaries = [
    renderPlanSummary(renderPlan),
    voiceoverAudioSummary(voiceoverAudio),
    draftRenderSummary(draftRender),
  ];
  const reviewRows = productionMediaStatus(
    { artifacts: [], runId },
    { draftRender, renderPlan, voiceoverAudio },
  );
  return summaries.map(
    (summary, index) =>
      `${summary} Review: ${productionMediaReviewAction(reviewRows[index], true)}`,
  );
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
    return `Draft render: pass (${Math.round(draftRender.durationSeconds)}s, ${draftRender.timelineSegments.join(" -> ")}${sourceFrameSummary(draftRender)}${sourceFrameCadenceSummary(draftRender)}${draftRenderVoiceoverSummary(draftRender)}${renderApprovalSummary(draftRender)}${mediaProbeSummary(draftRender.mediaProbe)}).`;
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
 * Summarizes the render approval that authorized a passed draft render.
 *
 * @param draftRender - Passed draft render evidence
 * @returns A render approval summary fragment.
 */
function renderApprovalSummary(
  draftRender: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  return `, approval ${draftRender.renderApproval.approvalId}`;
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
 * Summarizes exact source-frame cadence for a passed draft render.
 *
 * @param draftRender - Passed draft render evidence
 * @returns A cadence summary when source frames are available, or an empty string otherwise
 */
function sourceFrameCadenceSummary(
  draftRender: Extract<Awaited<ReturnType<typeof readDraftRenderEvidence>>, { status: "pass" }>,
): string {
  return draftRender.sourceFrameCadence.length > 0
    ? `, frame cadence ${draftRender.sourceFrameCadence.join("; ")}`
    : "";
}

/**
 * Summarizes the media probe dimensions for a draft render.
 *
 * @param mediaProbe - The media probe data for a passed draft render.
 * @returns A summary string with the probed video dimensions.
 */
function mediaProbeSummary(
  mediaProbe: Extract<
    Awaited<ReturnType<typeof readDraftRenderEvidence>>,
    { status: "pass" }
  >["mediaProbe"],
): string {
  return `, ffprobe ${mediaProbe.video.width}x${mediaProbe.video.height} audio`;
}
