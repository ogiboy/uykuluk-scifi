import { ProducerConfig } from "../config/schema.js";
import { writeRunJson } from "../core/artifacts.js";
import { RunRecord } from "../core/state.js";
import { saveRun } from "../core/runStore.js";
import { nowIso } from "../utils/time.js";

/**
 * Persists safe, non-raw diagnostics for provider failures during script generation.
 *
 * The raw provider response is intentionally not stored because model output can contain
 * unexpected secrets, prompt echoes, or large malformed payloads.
 */
export async function persistScriptGenerationFailure(
  run: RunRecord,
  config: ProducerConfig,
  error: unknown,
): Promise<RunRecord> {
  const message = error instanceof Error ? error.message : String(error);
  if (!isScriptProviderFailure(message)) {
    return run;
  }
  try {
    const updated = await writeRunJson(
      run,
      "script",
      "diagnostics/script_generation_failure.json",
      {
        runId: run.runId,
        stage: "script",
        state: run.state,
        providerMode: config.providers.llm.mode,
        model: config.providers.llm.model,
        thinkingMode: config.providers.llm.thinkingMode,
        message,
        createdAt: nowIso(),
      },
    );
    await saveRun(updated);
    return updated;
  } catch {
    return run;
  }
}

function isScriptProviderFailure(message: string): boolean {
  return /provider response|Ollama|llama\.cpp/i.test(message);
}
