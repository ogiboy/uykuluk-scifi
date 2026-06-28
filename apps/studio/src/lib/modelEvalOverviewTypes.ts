import type {
  LocalModelCandidateEvalReportPersisted,
  LocalModelEvalReportPersisted,
} from "../../../../src/diagnostics/localModelEvalSchema";

export type StudioModelEvalStatus = "blocked" | "invalid" | "missing" | "passing";

export type StudioModelEvalOverview = {
  candidateMarkdownPath: string;
  candidateReport: StudioCandidateEvalSummary | null;
  candidateReportPreview: string | null;
  candidateReportPreviewTruncated: boolean;
  error: string | null;
  nextCommand: string;
  singleMarkdownPath: string;
  singleReport: StudioSingleModelEvalSummary | null;
  singleReportPreview: string | null;
  singleReportPreviewTruncated: boolean;
  status: StudioModelEvalStatus;
};

export type StudioSingleModelEvalSummary = {
  appliedOverrides: string[];
  blockCount: number;
  checkCount: number;
  checks: StudioModelEvalCheckSummary[];
  configuredModel: string;
  configSource: LocalModelEvalReportPersisted["configSource"];
  createdAt: string;
  durationMs: number;
  passCount: number;
  passed: boolean;
  providerMode: LocalModelEvalReportPersisted["providerMode"];
};

export type StudioCandidateEvalSummary = {
  baseOverrides: string[];
  blockedCandidateCount: number;
  candidateCount: number;
  candidates: StudioCandidateModelSummary[];
  configSource: LocalModelCandidateEvalReportPersisted["configSource"];
  createdAt: string;
  durationMs: number;
  passed: boolean;
  passingCandidateCount: number;
  providerMode: LocalModelCandidateEvalReportPersisted["providerMode"];
  recommendedCandidate: StudioCandidateModelSummary | null;
};

export type StudioCandidateModelSummary = {
  blockCount: number;
  checks: StudioModelEvalCheckSummary[];
  configuredModel: string;
  durationMs: number;
  passCount: number;
  passed: boolean;
};

export type StudioModelEvalCheckSummary = {
  durationMs: number | null;
  inputTokensApprox: number | null;
  message: string;
  name: LocalModelEvalReportPersisted["checks"][number]["name"];
  outputHash: string | null;
  outputTokensApprox: number | null;
  promptHash: string | null;
  status: LocalModelEvalReportPersisted["checks"][number]["status"];
};
