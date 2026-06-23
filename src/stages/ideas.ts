import { loadConfig } from "../config/config.js";
import { writeRunJson, writeRunText } from "../core/artifacts.js";
import { createRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { defaultStagePricing } from "../costs/pricing.js";
import { enforceBudget } from "../safeguards/budgetGuard.js";
import { createLlmProvider } from "../providers/index.js";
import { createPromptProvenance } from "../prompts/provenance.js";
import { renderIdeasPrompt } from "../prompts/templates.js";
import { VideoIdea } from "./types.js";

type IdeasPayload = { ideas: VideoIdea[] };

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
    const result = await provider.generateText({
      model: config.providers.llm.model,
      temperature: 0.7,
      prompt: prompt.text,
    });
    const parsed = JSON.parse(result.text) as IdeasPayload;
    const ideas = parsed.ideas.slice(0, 10);
    await enforceBudget({
      run,
      config,
      stage: "ideas",
      provider: result.provider,
      model: result.model,
      estimatedUsd,
      inputTokens: result.inputTokensApprox,
      outputTokens: result.outputTokensApprox,
      durationMs: result.durationMs,
    });
    run = await writeRunJson(run, "ideas", "ideas.json", {
      ideas,
      prompt: createPromptProvenance(prompt.key, prompt.text, "ideas.json", prompt.source),
    });
    run = await writeRunText(run, "ideas", "ideas.md", renderIdeasMarkdown(ideas));
    run = await setRunState(run, "IDEAS_GENERATED", "ideas");
    return { runId: run.runId, ideas };
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
