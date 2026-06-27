export type EvidenceStatus = {
  blockedActions?: unknown[];
  currentState?: unknown;
  draftRender?: EvidenceMediaStatus;
  nextRecommendedCommand?: unknown;
  renderPlan?: EvidenceMediaStatus;
  runId?: unknown;
  voiceoverAudio?: EvidenceMediaStatus;
};

type EvidenceMediaStatus = {
  artifactCount?: unknown;
  assetCount?: unknown;
  durationSeconds?: unknown;
  mediaProbe?: unknown;
  message?: unknown;
  mode?: unknown;
  productionVoiceCandidate?: unknown;
  sourceFrameCount?: unknown;
  sourceFrameSegments?: unknown;
  sourceWordCount?: unknown;
  status?: unknown;
  timelineSegments?: unknown;
  voiceoverMode?: unknown;
  voiceoverProductionVoiceCandidate?: unknown;
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

/**
 * Builds production media statuses for the tracked artifacts.
 *
 * @param run - The run whose artifacts are used to determine recorded status.
 * @param evidence - Media evidence used to derive status and detail for each tracked artifact.
 * @returns The production media status entries for the configured artifacts.
 */
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

/**
 * Formats a production media status as a single bullet line.
 *
 * @param artifact - The media status to format
 * @returns A bullet line containing the label, status, and optional detail
 */
export function formatProductionMediaStatus(artifact: ProductionMediaStatus): string {
  const detail = artifact.detail ? ` (${artifact.detail})` : "";
  return `- ${artifact.label}: ${artifact.status}${detail}`;
}

/**
 * Determines the status for a production media artifact.
 *
 * @param run - The run artifact list used as a fallback source.
 * @param evidenceStatus - The evidence-reported status, when available.
 * @param artifactPath - The artifact path to check in the run.
 * @returns `"pass"`, `"block"`, or `"missing"` when provided by evidence; otherwise `"recorded"` if the artifact exists in `run.artifacts`, or `"missing"` if it does not.
 */
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

/**
 * Builds the detail text for a production media artifact.
 *
 * @param evidenceKey - The artifact category to describe
 * @param evidence - The evidence record for that artifact
 * @returns A detail message, or `undefined` when no detail is available
 */
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

/**
 * Describes render plan asset and artifact counts.
 *
 * @param evidence - Render plan media evidence
 * @returns A string in the form `"{assetCount} assets, {artifactCount} artifacts"` when both counts are available; otherwise, `undefined`
 */
function renderPlanDetail(evidence: EvidenceMediaStatus): string | undefined {
  const assetCount = evidence.assetCount;
  const artifactCount = evidence.artifactCount;
  if (typeof assetCount === "number" && typeof artifactCount === "number") {
    return `${assetCount} assets, ${artifactCount} artifacts`;
  }
  return undefined;
}

/**
 * Builds the voiceover evidence detail string.
 *
 * @param evidence - The voiceover evidence to describe.
 * @returns The joined detail text when available, or `undefined` when no detail can be derived.
 */
function voiceoverDetail(evidence: EvidenceMediaStatus): string | undefined {
  const parts = [
    durationDetail(evidence.durationSeconds),
    typeof evidence.mode === "string" ? evidence.mode : undefined,
    voiceoverQualityDetail(evidence.productionVoiceCandidate),
    sourceWordCountDetail(evidence.sourceWordCount),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Describes whether a voiceover is a production candidate or for timing/reference only.
 *
 * @param value - The voiceover candidate flag.
 * @returns "production voice candidate" when the flag is `true`, "timing/reference only" when the flag is `false`, or `undefined` otherwise.
 */
function voiceoverQualityDetail(value: unknown): string | undefined {
  if (value === true) {
    return "production voice candidate";
  }
  if (value === false) {
    return "timing/reference only";
  }
  return undefined;
}

/**
 * Builds detail text for a draft render evidence entry.
 *
 * @param evidence - The draft render evidence data
 * @returns A comma-separated detail string, or `undefined` when no details are available
 */
function draftRenderDetail(evidence: EvidenceMediaStatus): string | undefined {
  const parts = [
    durationDetail(evidence.durationSeconds),
    timelineDetail(evidence.timelineSegments),
    sourceFrameDetail(evidence),
    draftVoiceoverDetail(evidence),
    mediaProbeDetail(evidence.mediaProbe),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Formats a duration in seconds.
 *
 * @param value - The duration value to format.
 * @returns A rounded seconds string when `value` is a number, otherwise `undefined`.
 */
function durationDetail(value: unknown): string | undefined {
  return typeof value === "number" ? `${Math.round(value)}s` : undefined;
}

/**
 * Formats a source word count for display.
 *
 * @param value - The source word count
 * @returns The count followed by `source words`, or `undefined` when the value is not a number
 */
function sourceWordCountDetail(value: unknown): string | undefined {
  return typeof value === "number" ? `${value} source words` : undefined;
}

/**
 * Formats a timeline segment list.
 *
 * @param value - Timeline segment labels
 * @returns The segments joined with ` -> `, or `undefined` when the input is not a string array
 */
function timelineDetail(value: unknown): string | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.join(" -> ")
    : undefined;
}

/**
 * Describes the source frames represented by an evidence item.
 *
 * @param evidence - Media evidence to summarize
 * @returns A source-frame description, or `undefined` when no source-frame information is available
 */
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

/**
 * Describes an ffprobe media capture.
 *
 * @param value - The probe data to inspect
 * @returns A probe summary with video dimensions, optionally marked as audio, or `undefined` when the data is incomplete
 */
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

/**
 * Builds voiceover status details for draft render evidence.
 *
 * @param evidence - The media evidence to summarize
 * @returns A voiceover detail string, or `undefined` when no voiceover mode is available
 */
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
