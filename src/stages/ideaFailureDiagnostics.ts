import { ProducerConfig } from "../config/schema.js";
import { writeRunJson } from "../core/artifacts.js";
import { RunRecord } from "../core/state.js";
import { saveRun } from "../core/runStore.js";
import { nowIso } from "../utils/time.js";

/**
 * Persists safe, non-raw diagnostics for provider failures during idea generation.
 *
 * Rejected provider text is intentionally not stored because local model output can contain
 * malformed JSON, prompt echoes, or large repeated text that should not become durable state.
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
    await saveRun(updated);
    return updated;
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
    /Ollama/i.test(message)
  );
}
