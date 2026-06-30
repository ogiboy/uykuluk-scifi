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
  attemptCount: number;
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
  rejectedAttempts: Array<{
    contentHash: string;
    durationMs: number;
    inputTokensApprox?: number;
    model: string;
    outputTokensApprox?: number;
    promptHash: string;
    provider: string;
  }>;
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

type RejectedScriptAttempt = {
  prompt: string;
  reason: string;
  result: GenerateTextResult;
};

const maxScriptContentBlockerRepairAttempts = 2;

export async function generateScriptContentWithBlockerRetry<T>(
  input: ScriptContentGenerationInput<T>,
): Promise<ScriptContentGenerationResult<T>> {
  const rejectedAttempts: RejectedScriptAttempt[] = [];
  const prompts: string[] = [];
  let prompt = input.prompt;

  for (
    let attemptIndex = 0;
    attemptIndex <= maxScriptContentBlockerRepairAttempts;
    attemptIndex += 1
  ) {
    prompts.push(prompt);
    const attempt = await generateAttempt(input, prompt);
    if (attempt.parsed === undefined) {
      rejectedAttempts.push({
        prompt,
        reason: `contract_parse_failure: ${safeContractFailure(attempt.parseError)}`,
        result: attempt.result,
      });
      if (attemptIndex === maxScriptContentBlockerRepairAttempts) {
        throw new SafeExitError(
          `Invalid ${input.source}: ${formatRejectedReasons(
            rejectedAttempts,
          )} after ${maxScriptContentBlockerRepairAttempts} retries.`,
        );
      }
      prompt = renderScriptContentRetryPrompt(
        input.prompt,
        input.source,
        formatRejectedReasons(rejectedAttempts),
        attemptIndex + 1,
      );
      continue;
    }
    const blockers = blockingScriptWarnings(input.textOf(attempt.parsed), input.validationContext);
    if (blockers.length === 0) {
      if (rejectedAttempts.length === 0) {
        return { parsed: attempt.parsed, prompts, result: attempt.result };
      }
      const rejectedEvidence = rejectedAttempts.map((item) =>
        attemptEvidence(item.prompt, item.result),
      );
      return {
        blockerRetry: {
          attemptCount: rejectedAttempts.length + 1,
          blockers: formatRejectedBlockers(rejectedAttempts),
          rejectedAttempt: rejectedEvidence[0],
          rejectedAttempts: rejectedEvidence,
        },
        parsed: attempt.parsed,
        prompts,
        result: attempt.result,
      };
    }

    rejectedAttempts.push({
      prompt,
      reason: `content_blockers: ${formatScriptReviewBlockers(blockers)}`,
      result: attempt.result,
    });
    if (attemptIndex === maxScriptContentBlockerRepairAttempts) {
      throw scriptContentBlockerError(
        input.source,
        blockers,
        `after ${maxScriptContentBlockerRepairAttempts} retries`,
      );
    }

    prompt = renderScriptContentRetryPrompt(
      input.prompt,
      input.source,
      formatRejectedReasons(rejectedAttempts),
      attemptIndex + 1,
    );
  }

  throw new SafeExitError(`Invalid ${input.source}: exhausted content repair attempts.`);
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
): Promise<{ parseError?: string; parsed?: T; result: GenerateTextResult }> {
  const result = await input.provider.generateText({ ...input.request, prompt });
  try {
    return { parsed: input.parse(result.text), result };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
      result,
    };
  }
}

function formatRejectedBlockers(rejectedAttempts: Array<{ reason: string }>): string {
  return formatRejectedReasons(rejectedAttempts);
}

function formatRejectedReasons(rejectedAttempts: Array<{ reason: string }>): string {
  return rejectedAttempts
    .map((attempt, index) => `attempt ${index + 1}: ${attempt.reason}`)
    .join(" | ");
}

function safeContractFailure(message: string | undefined): string {
  const fallback = "provider response did not match the requested JSON contract";
  if (!message) return fallback;
  const firstLine = message.split(/\r?\n/u)[0]?.trim() || fallback;
  if (/Unexpected token|not valid JSON|JSON/u.test(firstLine)) {
    return "expected valid JSON";
  }
  const normalized = firstLine
    .replace(/^Invalid script section provider response:\s*/u, "")
    .replace(/^Invalid script continuation provider response:\s*/u, "");
  if (/missing|required|label|contract|schema|field|shape|format/iu.test(normalized)) {
    return normalized.slice(0, 180);
  }
  return fallback;
}

function renderScriptContentRetryPrompt(
  prompt: string,
  source: string,
  blockers: string,
  repairAttempt: number,
): string {
  const retryInstructions = [
    prompt,
    `## SCRIPT_CONTENT_RETRY attempt ${repairAttempt}/${maxScriptContentBlockerRepairAttempts}`,
    "The previous response was rejected before artifact persistence and must not be repeated.",
    `Rejected source: ${source}.`,
    `Safe blocker summary: ${blockers}.`,
    "Return a fresh valid response for the same contract.",
    "Write exactly four fresh Turkish sentences with four distinct sentence openings.",
    "Use only exact Turkish production labels `Anlatıcı:` and `Görsel:`.",
    "Do not repeat sentence skeletons, metaphors, visual directions, or rejected structures.",
    "Return only the JSON shape requested above.",
  ];

  if (repairAttempt < maxScriptContentBlockerRepairAttempts) {
    return retryInstructions.join("\n\n");
  }

  return [
    ...retryInstructions,
    "## SCRIPT_CONTENT_RETRY_STRICT_FINAL",
    "This is the final bounded repair attempt before fail-closed rejection.",
    "Use this exact four-sentence semantic ledger in order:",
    "1. `Anlatıcı:` one concrete measurement or observation.",
    "2. `Görsel:` one distinct visual change that does not reuse the same nouns or verbs.",
    "3. `Anlatıcı:` one cautious alternative explanation or limitation.",
    "4. `Anlatıcı:` one transition or closure sentence with a different opening.",
    "Never start two sentences with the same first three words after the label.",
    "Never repeat the same subject, verb, metaphor, or visual object across the four sentences.",
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
