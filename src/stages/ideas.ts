import type { ProducerConfig } from "../config/schema.js";
import { loadConfig } from "../config/config.js";
import { SafeExitError } from "../core/errors.js";
import { writeRunJson, writeRunText } from "../core/artifacts.js";
import { createRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { defaultStagePricing } from "../costs/pricing.js";
import { enforceBudget } from "../safeguards/budgetGuard.js";
import { createLlmProvider } from "../providers/index.js";
import type { GenerateTextResult, LlmProvider } from "../providers/llmProvider.js";
import { createPromptProvenance } from "../prompts/provenance.js";
import { renderIdeasPrompt, type RenderedPrompt } from "../prompts/templates.js";
import { ideasValidationSummary, renderIdeaRepairPrompt } from "./ideaRepairPrompt.js";
import { parseIdeasProviderPayload } from "./providerPayloads.js";
import { ideasResponseFormat } from "./providerResponseFormats.js";
import { VideoIdea } from "./types.js";

export { renderIdeaRepairPrompt } from "./ideaRepairPrompt.js";

type IdeaRepairEvidence = {
  attempted: boolean;
  attempts: number;
  validationErrors: string[];
};

type IdeaGenerationOutcome = {
  ideas: VideoIdea[];
  promptText: string;
  repair: IdeaRepairEvidence;
  result: GenerateTextResult;
};

const noIdeaRepair: IdeaRepairEvidence = {
  attempted: false,
  attempts: 0,
  validationErrors: [],
};
const maxIdeaRepairAttempts = 2;

/**
 * Generates a set of video ideas using an LLM and writes formatted artifacts to the run.
 *
 * @returns An object containing the run ID and the generated video ideas (up to 10).
 * @throws When generation or artifact writing fails.
 */
export async function runIdeas(): Promise<{ runId: string; ideas: VideoIdea[] }> {
  const config = await loadConfig();
  let run = await createRun();
  assertTransition(run.state, "IDEAS_GENERATED");
  const provider = createLlmProvider(config);
  try {
    const estimatedUsd = defaultStagePricing.ideas.estimatedUsd;
    await enforceBudget({
      run,
      config,
      stage: "ideas",
      provider: defaultStagePricing.ideas.provider,
      estimatedUsd,
      recordCostEvent: false,
    });
    const prompt = await renderIdeasPrompt();
    const generation = await generateIdeasWithRepair({
      config,
      prompt,
      provider,
      runId: run.runId,
    });
    await enforceBudget({
      run,
      config,
      stage: "ideas",
      provider: generation.result.provider,
      model: generation.result.model,
      estimatedUsd,
      inputTokens: generation.result.inputTokensApprox,
      outputTokens: generation.result.outputTokensApprox,
      durationMs: generation.result.durationMs,
    });
    run = await writeRunJson(run, "ideas", "ideas.json", {
      ideas: generation.ideas,
      prompt: createPromptProvenance(
        prompt.key,
        generation.promptText,
        "ideas.json",
        prompt.source,
      ),
      repair: generation.repair,
    });
    run = await writeRunText(run, "ideas", "ideas.md", renderIdeasMarkdown(generation.ideas));
    run = await setRunState(run, "IDEAS_GENERATED", "ideas");
    return { runId: run.runId, ideas: generation.ideas };
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "ideas",
      message: (error as Error).message,
    });
    throw error;
  }
}

async function generateIdeasWithRepair(input: {
  config: ProducerConfig;
  prompt: RenderedPrompt;
  provider: LlmProvider;
  runId: string;
}): Promise<IdeaGenerationOutcome> {
  const results: GenerateTextResult[] = [];
  const validationErrors: string[] = [];
  let promptText = input.prompt.text;
  for (let attempt = 0; attempt <= maxIdeaRepairAttempts; attempt += 1) {
    const result = await requestIdeas(input.provider, input.config, promptText);
    results.push(result);
    try {
      return {
        ideas: parseIdeasProviderPayload(result.text),
        promptText,
        repair: repairEvidence(validationErrors),
        result: combineProviderResults(results),
      };
    } catch (error) {
      if (!isIdeasValidationError(error)) {
        throw error;
      }
      if (attempt >= maxIdeaRepairAttempts) {
        throw new SafeExitError(
          `Invalid ideas provider response after repair attempt: ${ideasValidationSummary(
            error.message,
          )}`,
        );
      }
      validationErrors.push(error.message);
      await appendIdeaRepairWarning(input.runId, validationErrors);
      promptText = renderIdeaRepairPrompt(input.prompt.text, validationErrors);
    }
  }
  throw new SafeExitError("Ideas provider did not return a parseable response.");
}

function repairEvidence(validationErrors: string[]): IdeaRepairEvidence {
  return validationErrors.length
    ? { attempted: true, attempts: validationErrors.length, validationErrors }
    : noIdeaRepair;
}

async function appendIdeaRepairWarning(runId: string, validationErrors: string[]): Promise<void> {
  const validationError = validationErrors.at(-1) ?? "unknown ideas validation error";
  await appendLedgerEvent({
    runId,
    type: "WARNING",
    stage: "ideas",
    message: `Ideas provider response failed validation; retrying repair attempt ${validationErrors.length}/${maxIdeaRepairAttempts}.`,
    data: { validationError, validationErrors },
  });
}

function requestIdeas(
  provider: LlmProvider,
  config: ProducerConfig,
  prompt: string,
): Promise<GenerateTextResult> {
  return provider.generateText({
    model: config.providers.llm.model,
    temperature: 0.7,
    maxTokens: config.providers.llm.maxOutputTokens.ideas,
    responseFormat: ideasResponseFormat,
    prompt,
  });
}

function isIdeasValidationError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("Invalid ideas provider response");
}

function combineProviderResults(results: GenerateTextResult[]): GenerateTextResult {
  const last = results.at(-1);
  if (!last) {
    throw new SafeExitError("Ideas provider did not return a result.");
  }
  return {
    text: last.text,
    provider: last.provider,
    model: last.model,
    inputTokensApprox: sumOptionalNumbers(results.map((result) => result.inputTokensApprox)),
    outputTokensApprox: sumOptionalNumbers(results.map((result) => result.outputTokensApprox)),
    durationMs: results.reduce((sum, result) => sum + result.durationMs, 0),
  };
}

function sumOptionalNumbers(values: Array<number | undefined>): number | undefined {
  return values.every((value): value is number => typeof value === "number")
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;
}

function renderIdeasMarkdown(ideas: VideoIdea[]): string {
  return [
    "# UykulukSciFi Ideas",
    "",
    ...ideas.map((idea) =>
      [
        `## ${idea.id}: ${idea.title}`,
        "",
        `- Premise: ${idea.premise}`,
        `- Target duration: ${idea.targetDuration}`,
        `- Style: ${idea.style}`,
        `- Estimated difficulty: ${idea.estimatedDifficulty}`,
        `- Risk level: ${idea.riskLevel}`,
        `- Why it fits: ${idea.fit}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");
}
