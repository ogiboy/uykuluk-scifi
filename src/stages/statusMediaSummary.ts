import { mediaArtifactFacts } from "./statusMediaFacts.js";
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
const draftRenderArtifactPath = PRODUCTION_MEDIA_ARTIFACTS[2].path;
const renderPlanReviewArtifactPath = "production/storyboard_contact_sheet.md";

export function productionMediaStatus(
  run: { artifacts: readonly string[]; runId?: string },
  evidence: EvidenceStatus | null,
): ProductionMediaStatus[] {
  return PRODUCTION_MEDIA_ARTIFACTS.map((item) => {
    const status = mediaArtifactStatus(run, evidence?.[item.evidenceKey]?.status, item.path);
    const facts = mediaArtifactFacts(item.evidenceKey, evidence?.[item.evidenceKey], status);
    return {
      artifactPath: item.path,
      evidenceKey: item.evidenceKey,
      ...(facts.length > 0 ? { detail: facts.join(", "), facts } : {}),
      label: item.label,
      ...mediaPlaybackGuidance(run.runId, item.evidenceKey, evidence?.[item.evidenceKey], status),
      ...mediaReviewArtifactGuidance(item.evidenceKey, evidence?.[item.evidenceKey], status),
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

function mediaReviewArtifactGuidance(
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): Pick<ProductionMediaStatus, "reviewArtifactPath"> {
  if (status !== "pass") {
    return {};
  }
  if (typeof evidence?.reviewPath === "string") {
    return { reviewArtifactPath: evidence.reviewPath };
  }
  if (evidenceKey === "renderPlan") {
    return { reviewArtifactPath: renderPlanReviewArtifactPath };
  }
  return {};
}

function mediaPlaybackGuidance(
  runId: string | undefined,
  evidenceKey: ProductionMediaStatus["evidenceKey"],
  evidence: EvidenceMediaStatus | undefined,
  status: ProductionMediaStatus["status"],
): Pick<ProductionMediaStatus, "localPlaybackPath"> {
  if (status !== "pass") {
    return {};
  }
  if (evidenceKey === "voiceoverAudio" && typeof evidence?.localPlaybackPath === "string") {
    return { localPlaybackPath: evidence.localPlaybackPath };
  }
  const artifactPath = localPlaybackArtifactPath(evidenceKey);
  return runId && artifactPath ? { localPlaybackPath: `runs/${runId}/${artifactPath}` } : {};
}

function localPlaybackArtifactPath(
  evidenceKey: ProductionMediaStatus["evidenceKey"],
): string | null {
  if (evidenceKey === "voiceoverAudio") {
    return voiceoverAudioArtifactPath;
  }
  if (evidenceKey === "draftRender") {
    return draftRenderArtifactPath;
  }
  return null;
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
