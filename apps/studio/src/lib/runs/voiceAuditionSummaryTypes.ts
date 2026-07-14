import type {
  VoiceCandidate,
  VoiceCandidates,
} from "../../../../../src/stages/voice/catalog/voiceCatalogContracts";

export type StudioVoiceAuditionActionId =
  "voice.candidates" | "voice.preview" | "voice.reselect" | "voice.run" | "voice.select";

export type StudioVoiceAuditionActionBinding = Readonly<{
  actionId: StudioVoiceAuditionActionId;
  routePath: string;
}>;

export type StudioVoicePreviewSummary = Readonly<{
  artifactPath?: string;
  audioPath?: string;
  digest?: string;
  kind: "failed" | "invalid" | "missing" | "ready";
  mediaUrl: string | null;
  message: string;
}>;

export type StudioVoiceCandidateSummary = Readonly<{
  category: string;
  description?: string;
  eligibility: VoiceCandidate["productionEligibility"];
  isSelected: boolean;
  metadataFreshness: "fresh" | "stale";
  name: string;
  preview: StudioVoicePreviewSummary;
  productionRightsLabel: string;
  tiers: readonly string[];
  turkishSuitability: "unverified" | "verified";
  voiceId: string;
}>;

export type StudioVoiceSelectionHistoryItem = Readonly<{
  artifactPath: string;
  name: string;
  notes: string;
  productionRightsConfirmed: boolean;
  reason?: string;
  reviewedBy: string;
  selectedAt: string;
  selectionDigest: string;
  status: "current" | "reselected" | "superseded";
  voiceId: string;
}>;

export type StudioHostedVoiceExecution = Readonly<{
  approvalId: string;
  bindingDigest: string;
  quoteDigest: string;
}>;

export type StudioVoiceProductionSummary = Readonly<{
  alignment: Readonly<{ detail: string; status: "missing" | "pending" | "ready" }>;
  approval: Readonly<{
    approvalId?: string;
    detail: string;
    status: "approved" | "blocked" | "missing" | "pending";
  }>;
  hostedExecution: StudioHostedVoiceExecution | null;
  quote: Readonly<{
    budgetAllowed?: boolean;
    estimatedUsd?: number;
    status: "blocked" | "missing" | "ready";
  }>;
  quota: Readonly<{ limit: number; remaining: number; tier: string; used: number }> | null;
  synthesis: Readonly<{
    detail: string;
    durationSeconds?: number;
    mode?: string;
    status: "missing" | "ready";
  }>;
}>;

export type StudioVoiceAuditionSummary = Readonly<{
  actions: Readonly<Record<StudioVoiceAuditionActionId, StudioVoiceAuditionActionBinding | null>>;
  advanced: Readonly<{
    diagnostics: readonly string[];
    facts: readonly Readonly<{ label: string; value: string }>[];
    paths: readonly string[];
  }>;
  candidates: readonly StudioVoiceCandidateSummary[];
  catalog: Readonly<{
    fetchedAt?: string;
    kind: "invalid" | "missing" | "ready" | "stale";
    message: string;
    modelId?: string;
    path?: string;
  }>;
  currentSelection: StudioVoiceSelectionHistoryItem | null;
  executionMode: "hosted" | "local" | "unknown";
  executionModeMessage: string;
  history: readonly StudioVoiceSelectionHistoryItem[];
  production: StudioVoiceProductionSummary;
}>;

export type VoiceAuditionRun = Readonly<{
  approvals?: readonly unknown[];
  artifacts: string[];
  runId: string;
}>;

export type CatalogReadResult = Readonly<{
  catalog: VoiceCandidates | null;
  diagnostics: readonly string[];
  kind: StudioVoiceAuditionSummary["catalog"]["kind"];
  message: string;
  path?: string;
}>;

export type VoiceSummaryReadResult = Readonly<{
  alignment: StudioVoiceProductionSummary["alignment"];
  diagnostics: string[];
  facts: Array<{ label: string; value: string }>;
  paths: string[];
  summary: StudioVoiceProductionSummary["synthesis"];
}>;

/** Returns the combined identity that an explicit hosted-operation confirmation applies to. */
export function studioHostedVoiceExecutionIdentity(
  execution: StudioHostedVoiceExecution | null,
): string | null {
  return execution
    ? JSON.stringify([execution.approvalId, execution.bindingDigest, execution.quoteDigest])
    : null;
}

/** Rejects a prior confirmation whenever any current hosted-operation identity field changes. */
export function isStudioHostedVoiceExecutionConfirmed(
  execution: StudioHostedVoiceExecution | null,
  confirmedIdentity: string | null,
): boolean {
  const currentIdentity = studioHostedVoiceExecutionIdentity(execution);
  return currentIdentity !== null && currentIdentity === confirmedIdentity;
}
