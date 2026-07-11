import type { ProducerConfig } from "../config/schema.js";
import { nowIso } from "../utils/time.js";
import type { LocalModelEvalReport } from "./localModelEval.js";

/**
 * Builds a blocked candidate report when llama.cpp served-model diagnostics failed.
 *
 * @param config - The active producer configuration.
 * @param baseOverrides - The non-model overrides applied to the comparison.
 * @param candidate - The candidate model that could not be evaluated.
 * @param diagnosticMessage - The diagnostic failure message to preserve.
 * @returns A blocked local-model eval report for this candidate.
 */
export function llamaCppDiagnosticFailureReport(
  config: ProducerConfig,
  baseOverrides: string[],
  candidate: string,
  diagnosticMessage: string,
): LocalModelEvalReport {
  const message = `llama.cpp candidate preflight failed: ${diagnosticMessage}`;
  return blockedLlamaCppCandidateReport(config, baseOverrides, candidate, {
    parserMessage: message,
    qualityMessage: "Skipped because llama.cpp served-model diagnostics failed.",
  });
}

/**
 * Builds a blocked candidate report when llama.cpp is reachable but does not serve a candidate.
 *
 * @param config - The active producer configuration.
 * @param baseOverrides - The non-model overrides applied to the comparison.
 * @param candidate - The unserved candidate model.
 * @returns A blocked local-model eval report for this candidate.
 */
export function unservedLlamaCppCandidateReport(
  config: ProducerConfig,
  baseOverrides: string[],
  candidate: string,
): LocalModelEvalReport {
  const message =
    "llama.cpp candidate model is not served by the current local server. Start llama-server with this GGUF, then rerun candidate eval.";
  return blockedLlamaCppCandidateReport(config, baseOverrides, candidate, {
    parserMessage: message,
    qualityMessage: "Skipped because the llama.cpp candidate model is not served.",
  });
}

type BlockedLlamaCppCandidateMessages = { parserMessage: string; qualityMessage: string };

function blockedLlamaCppCandidateReport(
  config: ProducerConfig,
  baseOverrides: string[],
  candidate: string,
  messages: BlockedLlamaCppCandidateMessages,
): LocalModelEvalReport {
  return {
    appliedOverrides: [...baseOverrides, "model"],
    checks: [
      blockedEvalCheck("ideas-json", messages.parserMessage),
      blockedEvalCheck("script-section-json", messages.parserMessage),
      blockedEvalCheck("script-quality-guard", messages.qualityMessage),
    ],
    configSource: baseOverrides.length > 0 ? "cli-overrides" : "project",
    configuredModel: candidate,
    createdAt: nowIso(),
    durationMs: 0,
    passed: false,
    providerMode: config.providers.llm.mode,
  };
}

function blockedEvalCheck(
  name: LocalModelEvalReport["checks"][number]["name"],
  message: string,
): LocalModelEvalReport["checks"][number] {
  return { message, name, status: "block" };
}
