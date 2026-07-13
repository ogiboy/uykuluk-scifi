import { ProducerConfig } from "../../config/schema.js";
import { writeRunJson } from "../../core/artifacts.js";
import { saveRun } from "../../core/runStore.js";
import { RunRecord } from "../../core/state.js";
import { nowIso } from "../../utils/time.js";

/**
 * Persists sanitized diagnostics for recognized provider failures during idea generation.
 *
 * Returns the original run when the failure is not a recognized provider failure or persistence fails.
 *
 * @param error - The failure to sanitize and evaluate
 * @returns The saved run with diagnostics, or the original run if diagnostics are not persisted
 */
export async function persistIdeaGenerationFailure(
  run: RunRecord,
  config: ProducerConfig,
  error: unknown,
): Promise<RunRecord> {
  const message = safeIdeaFailureMessage(error);
  if (!message || !isIdeaProviderFailure(message)) {
    return run;
  }
  try {
    const updated = await writeRunJson(run, "ideas", "diagnostics/ideas_generation_failure.json", {
      runId: run.runId,
      stage: "ideas",
      state: run.state,
      providerMode: config.providers.llm.mode,
      model: config.providers.llm.model,
      thinkingMode: config.providers.llm.thinkingMode,
      message,
      createdAt: nowIso(),
    });
    return await saveRun(updated);
  } catch {
    return run;
  }
}

function safeIdeaFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/^Ollama request failed \(([^)]+)\):.*$/s, "Ollama request failed ($1).")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function isIdeaProviderFailure(message: string): boolean {
  return (
    message.startsWith("Invalid ideas provider response") ||
    message.startsWith("Ideas provider did not return") ||
    /Ollama|llama\.cpp/i.test(message)
  );
}
