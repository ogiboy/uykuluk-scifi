import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { assertTransition } from "../core/transitions";
import { defaultStagePricing } from "../costs/pricing";
import { enforceBudget } from "../safeguards/budgetGuard";
import { requireApproval, requireState } from "../safeguards/approvalGuard";
import { createLlmProvider } from "../providers";
import { createPromptProvenance } from "../prompts/provenance";
import { renderScriptPrompt } from "../prompts/templates";
import { ScriptMeta, VideoIdea } from "./types";

/**
 * Generates a Turkish video script from an approved video idea.
 *
 * @param runId - The ID of the run containing the approved idea
 * @returns Script metadata including word count, estimated duration, claims requiring fact-checking, and visual beat suggestions.
 */
export async function generateScript(runId: string): Promise<ScriptMeta> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "IDEA_APPROVED", "script");
  await requireApproval(run, "idea", "script");
  assertTransition(run.state, "SCRIPT_GENERATED");
  try {
    const ideas = JSON.parse(await readFile(artifactPath(run.runId, "ideas.json"), "utf8")) as {
      ideas: VideoIdea[];
    };
    const idea = ideas.ideas.find((item) => item.id === run.approvedIdeaId);
    if (!idea) {
      throw new Error(`Approved idea missing from ideas artifact: ${run.approvedIdeaId}`);
    }
    const estimatedUsd = defaultStagePricing.script.estimatedUsd;
    await enforceBudget({
      run,
      config,
      stage: "script",
      provider: defaultStagePricing.script.provider,
      estimatedUsd,
      recordCostEvent: false,
    });
    const provider = createLlmProvider(config);
    const prompt = await renderScriptPrompt(JSON.stringify(idea));
    const result = await provider.generateText({
      model: config.providers.llm.model,
      temperature: 0.6,
      prompt: prompt.text,
    });
    const script = result.text;
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    const meta: ScriptMeta = {
      estimatedDuration: `${Math.max(1, Math.round(wordCount / 135))}-${Math.max(2, Math.round(wordCount / 115))} dakika`,
      wordCount,
      tone: config.channel.defaultTone,
      claimsRequiringFactCheck: extractClaims(script),
      possibleVisualBeats: extractVisualBeats(script),
      provider: result.provider,
      model: result.model,
      inputTokensApprox: result.inputTokensApprox,
      outputTokensApprox: result.outputTokensApprox,
      durationMs: result.durationMs,
      prompt: createPromptProvenance(prompt.key, prompt.text, "script.md", prompt.source),
    };
    await enforceBudget({
      run,
      config,
      stage: "script",
      provider: result.provider,
      model: result.model,
      estimatedUsd,
      inputTokens: result.inputTokensApprox,
      outputTokens: result.outputTokensApprox,
      durationMs: result.durationMs,
    });
    run = await writeRunText(run, "script", "script.md", script);
    run = await writeRunJson(run, "script", "script.meta.json", meta);
    await setRunState(run, "SCRIPT_GENERATED", "script");
    return meta;
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "script",
      message: (error as Error).message,
    });
    throw error;
  }
}

function extractClaims(script: string): string[] {
  return script
    .split(/[.!?]\s+/)
    .filter((sentence) =>
      /\b(Europa|Enceladus|okyanus|gelgit|bilim|kanıt|kanit|gözlem|gozlem)\b/i.test(sentence),
    )
    .slice(0, 8);
}

function extractVisualBeats(script: string): string[] {
  return script
    .split("\n")
    .filter((line) =>
      /\b(goruntu|görüntü|kamera|buz|okyanus|isigi|ışığı|karanlik|karanlık)\b/i.test(line),
    )
    .slice(0, 8);
}
