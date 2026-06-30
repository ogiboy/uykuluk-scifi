import type {
  EvidenceMediaStatus,
  EvidenceStatus,
  ProductionMediaStatus,
} from "./statusMediaTypes.js";
export type {
  EvidenceMediaStatus,
  EvidenceStatus,
  EvidenceStatusValidationResult,
  ProductionMediaStatus,
} from "./statusMediaTypes.js";

const PRODUCTION_MEDIA_ARTIFACTS = [
  { evidenceKey: "renderPlan", label: "Render plan", path: "production/render_plan.json" },
  {
    evidenceKey: "voiceoverAudio",
    label: "Voiceover audio",
    path: "production/audio/voiceover.wav",
  },
  { evidenceKey: "draftRender", label: "Draft render", path: "production/render/draft.mp4" },
] as const;
const voiceoverAudioArtifactPath = PRODUCTION_MEDIA_ARTIFACTS[1].path;

export function productionMediaStatus(
  run: { artifacts: readonly string[]; runId?: string },
  evidence: EvidenceStatus | null,
): ProductionMediaStatus[] {
  return PRODUCTION_MEDIA_ARTIFACTS.map((item) => {
    const status = mediaArtifactStatus(run, evidence?.[item.evidenceKey]?.status, item.path);
    return {
      artifactPath: item.path,
      detail: mediaArtifactDetail(item.evidenceKey, evidence?.[item.evidenceKey], status),
      evidenceKey: item.evidenceKey,
      label: item.label,
      ...mediaPlaybackGuidance(run.runId, item.evidenceKey, evidence?.[item.evidenceKey], status),
      ...mediaRenderApprovalGuidance(
        run.runId,
        item.evidenceKey,
        evidence?.[item.evidenceKey],
        status,
      ),
      reviewCommand: mediaReviewCommand(run.runId, item.evidenceKey, status),
      status,
    };
  });
}

function mediaPlaybackGuidance(
  runId: string | undefined,
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): Pick<ProductionMediaStatus, "localPlaybackPath"> {
  if (evidenceKey !== "voiceoverAudio" || status !== "pass") {
    return {};
  }
  if (typeof evidence?.localPlaybackPath === "string") {
    return { localPlaybackPath: evidence.localPlaybackPath };
  }
  return runId ? { localPlaybackPath: `runs/${runId}/${voiceoverAudioArtifactPath}` } : {};
}

export function formatProductionMediaStatus(artifact: ProductionMediaStatus): string {
  const detail = artifact.detail ? ` (${artifact.detail})` : "";
  return `- ${artifact.label}: ${artifact.status}${detail}`;
}

function mediaRenderApprovalGuidance(
  runId: string | undefined,
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): Pick<ProductionMediaStatus, "renderApprovalCommand" | "renderApprovalScope"> {
  if (
    !runId ||
    evidenceKey !== "voiceoverAudio" ||
    status !== "pass" ||
    typeof evidence?.productionVoiceCandidate !== "boolean"
  ) {
    return {};
  }
  return {
    renderApprovalCommand: `pnpm producer approve render --run ${runId}`,
    renderApprovalScope: evidence.productionVoiceCandidate
      ? "production-voice-candidate"
      : "timing-draft-only",
  };
}

function mediaArtifactStatus(
  run: { artifacts: readonly string[] },
  evidenceStatus: unknown,
  artifactPath: string,
): ProductionMediaStatus["status"] {
  if (evidenceStatus === "pass" || evidenceStatus === "block" || evidenceStatus === "missing") {
    return evidenceStatus;
  }
  return run.artifacts.includes(artifactPath) ? "recorded" : "missing";
}

function mediaReviewCommand(
  runId: string | undefined,
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  status: ProductionMediaStatus["status"],
): string | undefined {
  if (!runId || status !== "pass") {
    return undefined;
  }
  if (evidenceKey === "renderPlan") {
    return `pnpm producer review render-plan --run ${runId}`;
  }
  if (evidenceKey === "voiceoverAudio") {
    return `pnpm producer review voice --run ${runId}`;
  }
  if (evidenceKey === "draftRender") {
    return `pnpm producer review render --run ${runId}`;
  }
  return undefined;
}

function mediaArtifactDetail(
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): string | undefined {
  if (status === "recorded") {
    return "artifact record only; regenerate evidence to verify current media";
  }
  if (!evidence) {
    return undefined;
  }
  if (evidence.status === "block" && typeof evidence.message === "string") {
    return evidence.message;
  }
  if (evidence.status !== "pass") {
    return undefined;
  }
  if (evidenceKey === "renderPlan") {
    return renderPlanDetail(evidence);
  }
  if (evidenceKey === "voiceoverAudio") {
    return voiceoverDetail(evidence);
  }
  return draftRenderDetail(evidence);
}

function renderPlanDetail(evidence: EvidenceMediaStatus): string | undefined {
  return typeof evidence.assetCount === "number" && typeof evidence.artifactCount === "number"
    ? `${evidence.assetCount} assets, ${evidence.artifactCount} artifacts`
    : undefined;
}

function voiceoverDetail(evidence: EvidenceMediaStatus): string | undefined {
  const parts = [
    durationDetail(evidence.durationSeconds),
    typeof evidence.mode === "string" ? evidence.mode : undefined,
    voiceoverQualityDetail(evidence.productionVoiceCandidate),
    sourceWordCountDetail(evidence.sourceWordCount),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
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

function draftRenderDetail(evidence: EvidenceMediaStatus): string | undefined {
  const parts = [
    durationDetail(evidence.durationSeconds),
    timelineDetail(evidence.timelineSegments),
    sourceFrameDetail(evidence),
    sourceFrameCadenceDetail(evidence.sourceFrameCadence),
    draftVoiceoverDetail(evidence),
    renderApprovalDetail(evidence.renderApproval),
    mediaProbeDetail(evidence.mediaProbe),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
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
