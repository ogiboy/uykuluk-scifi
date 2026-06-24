import { SafeExitError } from "../core/errors.js";
import type {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
} from "../providers/llmProvider.js";
import { reviewScriptContent, type ScriptReviewWarning } from "../safeguards/contentGuard.js";
import { formatScriptReviewBlockers } from "../safeguards/scriptReviewFormatting.js";
import { sha256 } from "../utils/hash.js";

export type ScriptContentBlockerRetryEvidence = {
  attemptCount: 2;
  blockers: string;
  rejectedAttempt: {
    contentHash: string;
    durationMs: number;
    inputTokensApprox?: number;
    model: string;
    outputTokensApprox?: number;
    promptHash: string;
    provider: string;
  };
};

export type ScriptContentGenerationResult<T> = {
  blockerRetry?: ScriptContentBlockerRetryEvidence;
  parsed: T;
  prompts: string[];
  result: GenerateTextResult;
};

type ScriptContentGenerationInput<T> = {
  parse: (text: string) => T;
  prompt: string;
  provider: LlmProvider;
  request: Omit<GenerateTextInput, "prompt">;
  source: string;
  textOf: (parsed: T) => string;
  validationContext?: string;
};

export async function generateScriptContentWithBlockerRetry<T>(
  input: ScriptContentGenerationInput<T>,
): Promise<ScriptContentGenerationResult<T>> {
  const first = await generateAttempt(input, input.prompt);
  const firstBlockers = blockingScriptWarnings(input.textOf(first.parsed), input.validationContext);
  if (firstBlockers.length === 0) {
    return { parsed: first.parsed, prompts: [input.prompt], result: first.result };
  }

  const blockers = formatScriptReviewBlockers(firstBlockers);
  const retryPrompt = renderScriptContentRetryPrompt(input.prompt, input.source, blockers);
  const retry = await generateAttempt(input, retryPrompt);
  const retryBlockers = blockingScriptWarnings(input.textOf(retry.parsed), input.validationContext);
  if (retryBlockers.length > 0) {
    throw scriptContentBlockerError(input.source, retryBlockers, "after 1 retry");
  }
  return {
    blockerRetry: {
      attemptCount: 2,
      blockers,
      rejectedAttempt: attemptEvidence(input.prompt, first.result),
    },
    parsed: retry.parsed,
    prompts: [input.prompt, retryPrompt],
    result: retry.result,
  };
}

export function scriptContentBlockerError(
  source: string,
  blockers: readonly ScriptReviewWarning[],
  suffix?: string,
): SafeExitError {
  const retrySuffix = suffix ? ` ${suffix}` : "";
  return new SafeExitError(
    `Invalid ${source}: blocking findings: ${formatScriptReviewBlockers(blockers)}${retrySuffix}.`,
  );
}

function blockingScriptWarnings(
  candidate: string,
  validationContext: string | undefined,
): ScriptReviewWarning[] {
  const reviewedText = validationContext ? `${validationContext}\n\n${candidate}` : candidate;
  return reviewScriptContent(reviewedText).filter((warning) => warning.severity === "blocker");
}

async function generateAttempt<T>(
  input: ScriptContentGenerationInput<T>,
  prompt: string,
): Promise<{ parsed: T; result: GenerateTextResult }> {
  const result = await input.provider.generateText({ ...input.request, prompt });
  return { parsed: input.parse(result.text), result };
}

function renderScriptContentRetryPrompt(prompt: string, source: string, blockers: string): string {
  return [
    prompt,
    "## SCRIPT_CONTENT_RETRY",
    "The previous response was rejected before artifact persistence and must not be repeated.",
    `Rejected source: ${source}.`,
    `Safe blocker summary: ${blockers}.`,
    "Return a fresh valid response for the same contract.",
    "Write exactly four fresh Turkish sentences with four distinct sentence openings.",
    "Use only exact Turkish production labels `Anlatıcı:` and `Görsel:`.",
    "Do not repeat sentence skeletons, metaphors, visual directions, or rejected structures.",
    "Return only the JSON shape requested above.",
  ].join("\n\n");
}

function attemptEvidence(prompt: string, result: GenerateTextResult) {
  return {
    contentHash: sha256(result.text),
    durationMs: result.durationMs,
    inputTokensApprox: result.inputTokensApprox,
    model: result.model,
    outputTokensApprox: result.outputTokensApprox,
    promptHash: sha256(prompt),
    provider: result.provider,
  };
}
