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
  const failure = classifyScriptFailure(message);
  try {
    const updated = await writeRunJson(
      run,
      "script",
      "diagnostics/script_generation_failure.json",
      {
        ...failure,
        runId: run.runId,
        stage: "script",
        state: run.state,
        providerMode: config.providers.llm.mode,
        model: config.providers.llm.model,
        thinkingMode: config.providers.llm.thinkingMode,
        message,
        nextAction: scriptFailureNextAction(run.runId, failure.failureKind),
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

function classifyScriptFailure(message: string):
  | {
      failureKind: "below_long_form_floor";
      requiredWordCount: number;
      wordCount: number;
    }
  | { failureKind: "content_blocker" | "provider_contract" } {
  const longFormMatch =
    /below the long-form floor after bounded continuation passes \((\d+)\/(\d+) words\)/u.exec(
      message,
    );
  if (longFormMatch) {
    return {
      failureKind: "below_long_form_floor",
      wordCount: Number(longFormMatch[1]),
      requiredWordCount: Number(longFormMatch[2]),
    };
  }
  if (/blocking findings|content_blockers/u.test(message)) {
    return { failureKind: "content_blocker" };
  }
  return { failureKind: "provider_contract" };
}

function scriptFailureNextAction(runId: string, failureKind: string): string {
  if (failureKind === "below_long_form_floor") {
    return [
      "Try a stronger or larger local script model, or raise providers.llm.maxOutputTokens.script",
      `in producer.config.json, then rerun pnpm producer script --run ${runId}.`,
    ].join(" ");
  }
  return `Review provider/model configuration, then rerun pnpm producer script --run ${runId}.`;
}
