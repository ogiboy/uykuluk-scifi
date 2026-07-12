import { ProducerConfig } from "../../config/schema.js";
import { writeRunJson } from "../../core/artifacts.js";
import { saveRun } from "../../core/runStore.js";
import { RunRecord } from "../../core/state.js";
import { nowIso } from "../../utils/time.js";
import { receiptDurationMs, sectionProviderCallCount } from "./scriptSectionGeneration.js";
import type { ScriptSectionReceipt } from "./scriptSections.js";

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
  receipts: readonly ScriptSectionReceipt[] = [],
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
        generation: summarizeFailedGeneration(receipts),
        createdAt: nowIso(),
      },
    );
    await saveRun(updated);
    return updated;
  } catch {
    return run;
  }
}

function summarizeFailedGeneration(receipts: readonly ScriptSectionReceipt[]) {
  const passes = ["draft", "expansion", "continuation"] as const;
  return {
    receiptCount: receipts.length,
    providerCallCount: sectionProviderCallCount([...receipts]),
    acceptedWordCount: receipts.reduce((sum, receipt) => sum + receipt.wordCount, 0),
    durationMs: receipts.reduce((sum, receipt) => sum + receiptDurationMs(receipt), 0),
    passes: passes.map((pass) => {
      const matching = receipts.filter((receipt) => receipt.pass === pass);
      return {
        pass,
        receiptCount: matching.length,
        acceptedWordCount: matching.reduce((sum, receipt) => sum + receipt.wordCount, 0),
      };
    }),
  };
}

function isScriptProviderFailure(message: string): boolean {
  return /provider response|Ollama|llama\.cpp/i.test(message);
}

function classifyScriptFailure(
  message: string,
):
  | { failureKind: "below_long_form_floor"; requiredWordCount: number; wordCount: number }
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
      "Review the safe generation summary, then use a stronger local model or adjust the bounded",
      `script contract before rerunning pnpm producer script --run ${runId}.`,
    ].join(" ");
  }
  return `Review provider/model configuration, then rerun pnpm producer script --run ${runId}.`;
}
