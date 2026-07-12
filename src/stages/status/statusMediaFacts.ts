import type { EvidenceMediaStatus, ProductionMediaStatus } from "./statusMediaTypes.js";

/**
 * Builds structured evidence facts for a production-media status row.
 *
 * @param evidenceKey - The media evidence section being summarized.
 * @param evidence - The evidence payload for the media section.
 * @param status - The projected media row status.
 * @returns Short and detailed facts used by CLI and Studio review surfaces.
 */
export function mediaArtifactFacts(
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): string[] {
  if (status === "recorded") {
    return ["artifact record only; regenerate evidence to verify current media"];
  }
  if (!evidence) {
    return [];
  }
  if (evidence.status === "block" && typeof evidence.message === "string") {
    return [evidence.message];
  }
  if (evidence.status !== "pass") {
    return [];
  }
  if (evidenceKey === "renderPlan") {
    return renderPlanFacts(evidence);
  }
  if (evidenceKey === "voiceoverAudio") {
    return voiceoverFacts(evidence);
  }
  return draftRenderFacts(evidence);
}

function renderPlanFacts(evidence: EvidenceMediaStatus): string[] {
  return typeof evidence.assetCount === "number" && typeof evidence.artifactCount === "number"
    ? [`${evidence.assetCount} assets`, `${evidence.artifactCount} artifacts`]
    : [];
}

function voiceoverFacts(evidence: EvidenceMediaStatus): string[] {
  return [
    durationDetail(evidence.durationSeconds),
    typeof evidence.mode === "string" ? evidence.mode : undefined,
    voiceoverQualityDetail(evidence.productionVoiceCandidate),
    sourceWordCountDetail(evidence.sourceWordCount),
  ].filter((part): part is string => Boolean(part));
}

function voiceoverQualityDetail(value: unknown): string | undefined {
  if (value === true) {
    return "production voice candidate";
  }
  if (value === false) {
    return "timing/reference only";
  }
  return undefined;
}

function draftRenderFacts(evidence: EvidenceMediaStatus): string[] {
  return [
    durationDetail(evidence.durationSeconds),
    timelineDetail(evidence.timelineSegments),
    sourceFrameDetail(evidence),
    sourceFrameCadenceDetail(evidence.sourceFrameCadence),
    draftVoiceoverDetail(evidence),
    renderApprovalDetail(evidence.renderApproval),
    mediaProbeDetail(evidence.mediaProbe),
  ].filter((part): part is string => Boolean(part));
}

function durationDetail(value: unknown): string | undefined {
  return typeof value === "number" ? `${Math.round(value)}s` : undefined;
}

function sourceWordCountDetail(value: unknown): string | undefined {
  return typeof value === "number" ? `${value} source words` : undefined;
}

function timelineDetail(value: unknown): string | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.join(" -> ")
    : undefined;
}

function sourceFrameDetail(evidence: EvidenceMediaStatus): string | undefined {
  if (
    Array.isArray(evidence.sourceFrameSegments) &&
    evidence.sourceFrameSegments.every((item) => typeof item === "string") &&
    evidence.sourceFrameSegments.length > 0
  ) {
    return `source frames ${evidence.sourceFrameSegments.join("/")}`;
  }
  return typeof evidence.sourceFrameCount === "number" && evidence.sourceFrameCount > 0
    ? `${evidence.sourceFrameCount} source frames`
    : undefined;
}

function sourceFrameCadenceDetail(value: unknown): string | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") && value.length > 0
    ? `frame cadence ${value.join("; ")}`
    : undefined;
}

function mediaProbeDetail(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const video = "video" in value ? value.video : undefined;
  const audio = "audio" in value ? value.audio : undefined;
  if (!video || typeof video !== "object") {
    return undefined;
  }
  const width = "width" in video ? video.width : undefined;
  const height = "height" in video ? video.height : undefined;
  if (typeof width !== "number" || typeof height !== "number") {
    return undefined;
  }
  return audio && typeof audio === "object"
    ? `ffprobe ${width}x${height} audio`
    : `ffprobe ${width}x${height}`;
}

function renderApprovalDetail(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const approvalId = "approvalId" in value ? value.approvalId : undefined;
  return typeof approvalId === "string" && approvalId.length > 0
    ? `approval ${approvalId}`
    : undefined;
}

function draftVoiceoverDetail(evidence: EvidenceMediaStatus): string | undefined {
  if (typeof evidence.voiceoverMode !== "string") {
    return undefined;
  }
  if (evidence.voiceoverProductionVoiceCandidate === true) {
    return `voiceover ${evidence.voiceoverMode} production candidate`;
  }
  if (evidence.voiceoverProductionVoiceCandidate === false) {
    return `voiceover ${evidence.voiceoverMode} timing/reference only`;
  }
  return `voiceover ${evidence.voiceoverMode}`;
}
