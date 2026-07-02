import type { LocalModelEvalReport } from "./localModelEval.js";

export type LocalModelCandidateRecommendation = {
  blockedChecks: number;
  configuredModel: string;
  durationMs: number;
  passedChecks: number;
};

/**
 * Selects the strongest passing candidate from a local model comparison report.
 *
 * @param candidates - Evaluated model candidates.
 * @returns The deterministic recommendation summary, or `null` when no candidate passed.
 */
export function selectRecommendedLocalModelCandidate(
  candidates: LocalModelEvalReport[],
): LocalModelCandidateRecommendation | null {
  const passingCandidates = candidates.flatMap((candidate) =>
    candidate.passed ? [candidateRecommendationSummary(candidate)] : [],
  );
  if (passingCandidates.length === 0) {
    return null;
  }
  return [...passingCandidates].sort(candidateRecommendationSort)[0] ?? null;
}

function candidateRecommendationSummary(
  candidate: LocalModelEvalReport,
): LocalModelCandidateRecommendation {
  return {
    blockedChecks: candidate.checks.filter((check) => check.status === "block").length,
    configuredModel: candidate.configuredModel,
    durationMs: candidate.durationMs,
    passedChecks: candidate.checks.filter((check) => check.status === "pass").length,
  };
}

function candidateRecommendationSort(
  left: LocalModelCandidateRecommendation,
  right: LocalModelCandidateRecommendation,
): number {
  return (
    right.passedChecks - left.passedChecks ||
    left.blockedChecks - right.blockedChecks ||
    left.durationMs - right.durationMs ||
    left.configuredModel.localeCompare(right.configuredModel)
  );
}
