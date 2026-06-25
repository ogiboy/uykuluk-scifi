export type EvidenceStatus = {
  blockedActions?: unknown[];
  draftRender?: EvidenceMediaStatus;
  nextRecommendedCommand?: unknown;
  renderPlan?: EvidenceMediaStatus;
  voiceoverAudio?: EvidenceMediaStatus;
};

type EvidenceMediaStatus = {
  artifactCount?: unknown;
  assetCount?: unknown;
  durationSeconds?: unknown;
  mediaProbe?: unknown;
  message?: unknown;
  mode?: unknown;
  sourceFrameCount?: unknown;
  sourceFrameSegments?: unknown;
  sourceWordCount?: unknown;
  status?: unknown;
  timelineSegments?: unknown;
};

export type ProductionMediaStatus = {
  artifactPath: string;
  detail?: string;
  evidenceKey: "draftRender" | "renderPlan" | "voiceoverAudio";
  label: string;
  status: "block" | "missing" | "pass" | "recorded";
};

const PRODUCTION_MEDIA_ARTIFACTS = [
  {
    evidenceKey: "renderPlan",
    label: "Render plan",
    path: "production/render_plan.json",
  },
  {
    evidenceKey: "voiceoverAudio",
    label: "Voiceover audio",
    path: "production/audio/voiceover.wav",
  },
  {
    evidenceKey: "draftRender",
    label: "Draft render",
    path: "production/render/draft.mp4",
  },
] as const;

export function productionMediaStatus(
  run: { artifacts: readonly string[] },
  evidence: EvidenceStatus | null,
): ProductionMediaStatus[] {
  return PRODUCTION_MEDIA_ARTIFACTS.map((item) => ({
    artifactPath: item.path,
    detail: mediaArtifactDetail(item.evidenceKey, evidence?.[item.evidenceKey]),
    evidenceKey: item.evidenceKey,
    label: item.label,
    status: mediaArtifactStatus(run, evidence?.[item.evidenceKey]?.status, item.path),
  }));
}

export function formatProductionMediaStatus(artifact: ProductionMediaStatus): string {
  const detail = artifact.detail ? ` (${artifact.detail})` : "";
  return `- ${artifact.label}: ${artifact.status}${detail}`;
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

function mediaArtifactDetail(
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
): string | undefined {
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
  const assetCount = evidence.assetCount;
  const artifactCount = evidence.artifactCount;
  if (typeof assetCount === "number" && typeof artifactCount === "number") {
    return `${assetCount} assets, ${artifactCount} artifacts`;
  }
  return undefined;
}

function voiceoverDetail(evidence: EvidenceMediaStatus): string | undefined {
  const parts = [
    durationDetail(evidence.durationSeconds),
    typeof evidence.mode === "string" ? evidence.mode : undefined,
    sourceWordCountDetail(evidence.sourceWordCount),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function draftRenderDetail(evidence: EvidenceMediaStatus): string | undefined {
  const parts = [
    durationDetail(evidence.durationSeconds),
    timelineDetail(evidence.timelineSegments),
    sourceFrameDetail(evidence),
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
