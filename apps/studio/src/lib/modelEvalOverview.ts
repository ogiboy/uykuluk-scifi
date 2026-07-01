import { readFile } from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";
import {
  localModelCandidateEvalReportSchema,
  localModelEvalReportSchema,
  type LocalModelCandidateEvalReportPersisted,
  type LocalModelEvalReportPersisted,
} from "../../../../src/diagnostics/localModelEvalSchema";
import { ArtifactJsonParseError, parseArtifactJson, readOptionalText } from "./localArtifactReads";
import type {
  StudioCandidateEvalSummary,
  StudioCandidateModelSummary,
  StudioModelEvalCheckSummary,
  StudioModelEvalOverview,
  StudioModelEvalStatus,
  StudioSingleModelEvalSummary,
} from "./modelEvalOverviewTypes";
import { projectRoot } from "./projectRoot";

export type {
  StudioCandidateEvalSummary,
  StudioCandidateModelSummary,
  StudioModelEvalCheckSummary,
  StudioModelEvalOverview,
  StudioModelEvalStatus,
  StudioSingleModelEvalSummary,
} from "./modelEvalOverviewTypes";

const SINGLE_JSON_PATH = "diagnostics/local_model_eval.json";
const SINGLE_MARKDOWN_PATH = "diagnostics/local_model_eval.md";
const CANDIDATE_JSON_PATH = "diagnostics/local_model_candidates_eval.json";
const CANDIDATE_MARKDOWN_PATH = "diagnostics/local_model_candidates_eval.md";
const REPORT_PREVIEW_LIMIT = 3_000;

/**
 * Loads local model evaluation artifacts for read-only Studio display.
 *
 * @returns A Studio-safe overview of single-model and candidate comparison reports.
 */
export async function getStudioModelEvalOverview(): Promise<StudioModelEvalOverview> {
  const root = projectRoot();
  const [singlePreview, candidatePreview, singleResult, candidateResult] = await Promise.all([
    readOptionalText(path.join(root, ...SINGLE_MARKDOWN_PATH.split("/")), REPORT_PREVIEW_LIMIT),
    readOptionalText(path.join(root, ...CANDIDATE_MARKDOWN_PATH.split("/")), REPORT_PREVIEW_LIMIT),
    readSingleReport(root),
    readCandidateReport(root),
  ]);
  const error = singleResult.error ?? candidateResult.error;
  const singleReport = singleResult.report;
  const candidateReport = candidateResult.report;

  return {
    candidateMarkdownPath: CANDIDATE_MARKDOWN_PATH,
    candidateReport,
    candidateReportPreview: candidatePreview.text,
    candidateReportPreviewTruncated: candidatePreview.truncated,
    error,
    nextCommand: modelEvalNextCommand(error, singleReport, candidateReport),
    singleMarkdownPath: SINGLE_MARKDOWN_PATH,
    singleReport,
    singleReportPreview: singlePreview.text,
    singleReportPreviewTruncated: singlePreview.truncated,
    status: modelEvalStatus(error, singleReport, candidateReport),
  };
}

async function readSingleReport(
  root: string,
): Promise<{ error: string | null; report: StudioSingleModelEvalSummary | null }> {
  try {
    const raw = await readFile(path.join(root, ...SINGLE_JSON_PATH.split("/")), "utf8");
    const report = localModelEvalReportSchema.parse(parseArtifactJson(raw, SINGLE_JSON_PATH));
    return { error: null, report: summarizeSingleReport(report) };
  } catch (error) {
    return reportReadResult(error, SINGLE_JSON_PATH);
  }
}

async function readCandidateReport(
  root: string,
): Promise<{ error: string | null; report: StudioCandidateEvalSummary | null }> {
  try {
    const raw = await readFile(path.join(root, ...CANDIDATE_JSON_PATH.split("/")), "utf8");
    const report = localModelCandidateEvalReportSchema.parse(
      parseArtifactJson(raw, CANDIDATE_JSON_PATH),
    );
    return { error: null, report: summarizeCandidateReport(report) };
  } catch (error) {
    return reportReadResult(error, CANDIDATE_JSON_PATH);
  }
}

function reportReadResult(
  error: unknown,
  artifactPath: string,
): { error: string | null; report: null } {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return { error: null, report: null };
  }
  if (error instanceof ArtifactJsonParseError) {
    return { error: `${artifactPath} contains malformed JSON or a truncated write.`, report: null };
  }
  if (error instanceof ZodError) {
    return { error: `${artifactPath} is missing required fields.`, report: null };
  }
  return { error: `${artifactPath} could not be read.`, report: null };
}

function summarizeSingleReport(
  report: LocalModelEvalReportPersisted,
): StudioSingleModelEvalSummary {
  return {
    appliedOverrides: report.appliedOverrides,
    blockCount: countChecks(report, "block"),
    checkCount: report.checks.length,
    configuredModel: report.configuredModel,
    configSource: report.configSource,
    createdAt: report.createdAt,
    durationMs: report.durationMs,
    passCount: countChecks(report, "pass"),
    passed: report.passed,
    providerMode: report.providerMode,
    checks: summarizeChecks(report),
  };
}

function summarizeCandidateReport(
  report: LocalModelCandidateEvalReportPersisted,
): StudioCandidateEvalSummary {
  const candidates = report.candidates.map((candidate) => ({
    blockCount: countChecks(candidate, "block"),
    checks: summarizeChecks(candidate),
    configuredModel: candidate.configuredModel,
    durationMs: candidate.durationMs,
    passCount: countChecks(candidate, "pass"),
    passed: candidate.passed,
  }));
  return {
    baseOverrides: report.baseOverrides,
    blockedCandidateCount: candidates.filter((candidate) => !candidate.passed).length,
    candidateCount: candidates.length,
    candidates,
    configSource: report.configSource,
    createdAt: report.createdAt,
    durationMs: report.durationMs,
    passed: report.passed,
    passingCandidateCount: candidates.filter((candidate) => candidate.passed).length,
    providerMode: report.providerMode,
    operatorGuidance: report.operatorGuidance ?? null,
    recommendedCandidate: selectRecommendedCandidate(candidates, report.recommendedCandidate),
  };
}

function countChecks(report: LocalModelEvalReportPersisted, status: "block" | "pass"): number {
  return report.checks.filter((check) => check.status === status).length;
}

function summarizeChecks(report: LocalModelEvalReportPersisted): StudioModelEvalCheckSummary[] {
  return report.checks.map((check) => ({
    durationMs: check.durationMs ?? null,
    inputTokensApprox: check.inputTokensApprox ?? null,
    message: check.message,
    name: check.name,
    outputHash: check.outputHash ?? null,
    outputTokensApprox: check.outputTokensApprox ?? null,
    promptHash: check.promptHash ?? null,
    status: check.status,
  }));
}

function selectRecommendedCandidate(
  candidates: StudioCandidateModelSummary[],
  persistedRecommendation: LocalModelCandidateEvalReportPersisted["recommendedCandidate"],
): StudioCandidateModelSummary | null {
  if (persistedRecommendation) {
    const persistedCandidate = candidates.find(
      (candidate) => candidate.configuredModel === persistedRecommendation.configuredModel,
    );
    if (persistedCandidate?.passed) {
      return persistedCandidate;
    }
  }
  const passingCandidates = candidates.filter((candidate) => candidate.passed);
  if (passingCandidates.length === 0) {
    return null;
  }
  return [...passingCandidates].sort(candidateRankSort)[0] ?? null;
}

function candidateRankSort(
  left: StudioCandidateModelSummary,
  right: StudioCandidateModelSummary,
): number {
  return (
    right.passCount - left.passCount ||
    left.blockCount - right.blockCount ||
    left.durationMs - right.durationMs ||
    left.configuredModel.localeCompare(right.configuredModel)
  );
}

function modelEvalStatus(
  error: string | null,
  singleReport: StudioSingleModelEvalSummary | null,
  candidateReport: StudioCandidateEvalSummary | null,
): StudioModelEvalStatus {
  if (error) {
    return "invalid";
  }
  if (!singleReport && !candidateReport) {
    return "missing";
  }
  if (candidateReport?.recommendedCandidate && candidateReport.passed === false) {
    return "recommended";
  }
  return singleReport?.passed === false || candidateReport?.passed === false
    ? "blocked"
    : "passing";
}

function modelEvalNextCommand(
  error: string | null,
  singleReport: StudioSingleModelEvalSummary | null,
  candidateReport: StudioCandidateEvalSummary | null,
): string {
  if (error) {
    return "pnpm producer eval local-model --json";
  }
  if (!singleReport) {
    return "pnpm producer eval local-model";
  }
  if (!candidateReport) {
    return "pnpm producer eval local-model-candidates --candidate <model-a> --candidate <model-b>";
  }
  return (
    candidateReport.operatorGuidance?.nextCommand ??
    "pnpm producer eval local-model-candidates --candidate <model>"
  );
}
