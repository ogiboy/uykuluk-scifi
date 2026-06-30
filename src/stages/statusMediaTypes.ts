import type { VoiceoverRenderApprovalScope } from "./voiceoverReviewCommands.js";

export type EvidenceStatus = {
  blockedActions?: unknown[];
  currentState?: unknown;
  draftRender?: EvidenceMediaStatus;
  nextRecommendedCommand?: unknown;
  renderPlan?: EvidenceMediaStatus;
  runId?: unknown;
  voiceoverAudio?: EvidenceMediaStatus;
};

export type EvidenceMediaStatus = {
  artifactCount?: unknown;
  assetCount?: unknown;
  durationSeconds?: unknown;
  ffmpegReviewCommand?: unknown;
  mediaProbe?: unknown;
  message?: unknown;
  mode?: unknown;
  productionVoiceCandidate?: unknown;
  renderApproval?: unknown;
  sourceFrameCadence?: unknown;
  sourceFrameCount?: unknown;
  sourceFrameSegments?: unknown;
  sourceWordCount?: unknown;
  status?: unknown;
  timelineSegments?: unknown;
  voiceoverMode?: unknown;
  voiceoverProductionVoiceCandidate?: unknown;
};

export type EvidenceStatusValidationResult =
  | { evidence: EvidenceStatus; kind: "present" }
  | { kind: "missing" }
  | { kind: "invalid"; message: string }
  | { kind: "stale"; message: string };

export type ProductionMediaStatus = {
  artifactPath: string;
  detail?: string;
  evidenceKey: "draftRender" | "renderPlan" | "voiceoverAudio";
  label: string;
  reviewCommand?: string;
  renderApprovalCommand?: string;
  renderApprovalScope?: VoiceoverRenderApprovalScope;
  status: "block" | "missing" | "pass" | "recorded";
};
