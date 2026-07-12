import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config.js";
import { artifactPath, removeRunArtifact, writeRunJson, writeRunText } from "../core/artifacts.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { defaultStagePricing } from "../costs/pricing.js";
import { createPromptProvenance } from "../prompts/provenance.js";
import { renderScriptPrompt } from "../prompts/templates.js";
import { createLlmProvider } from "../providers/index.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { enforceBudget } from "../safeguards/budgetGuard.js";
import { reviewScriptContent } from "../safeguards/contentGuard.js";
import { countSpokenNarrationWords } from "../utils/scriptProductionText.js";
import { scriptContentBlockerError } from "./script/scriptContentRetry.js";
import {
  applyLongFormContinuations,
  assertLongFormWordFloor,
} from "./script/scriptContinuation.js";
import { persistScriptGenerationFailure } from "./script/scriptFailureDiagnostics.js";
import { extractClaims, extractVisualBeats } from "./script/scriptMetaExtractors.js";
import {
  generateScriptSections,
  receiptDurationMs,
  receiptInputTokens,
  receiptOutputTokens,
  sectionProviderCallCount,
} from "./script/scriptSectionGeneration.js";
import {
  assembleScriptFromSections,
  scriptSectionExpansionChunks,
  scriptSectionPlans,
  type ScriptSectionReceipt,
} from "./script/scriptSections.js";
import { ScriptMeta, VideoIdea } from "./types.js";

export async function generateScript(runId: string): Promise<ScriptMeta> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  let generationReceipts: ScriptSectionReceipt[] = [];
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
    const { promptTexts, sectionOutputs, sectionReceipts } = await generateScriptSections({
      basePrompt: prompt.text,
      config,
      provider,
    });
    generationReceipts = sectionReceipts;
    await applyLongFormContinuations({
      basePrompt: prompt.text,
      config,
      provider,
      promptTexts,
      sectionOutputs,
      sectionReceipts,
      title: idea.title,
    });
    const script = assembleScriptFromSections(idea.title, sectionOutputs);
    assertLongFormWordFloor(script);
    const assembledBlockers = reviewBlockers(script);
    if (assembledBlockers.length > 0) {
      throw scriptContentBlockerError("assembled script provider response", assembledBlockers);
    }
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    const narrationWordCount = countSpokenNarrationWords(script);
    const meta: ScriptMeta = {
      estimatedDuration: `${Math.max(1, Math.round(narrationWordCount / 135))}-${Math.max(2, Math.round(narrationWordCount / 115))} dakika`,
      wordCount,
      narrationWordCount,
      tone: config.channel.defaultTone,
      claimsRequiringFactCheck: extractClaims(script),
      possibleVisualBeats: extractVisualBeats(script),
      provider: sectionReceipts[0]?.provider ?? "unknown",
      model: sectionReceipts[0]?.model ?? config.providers.llm.model,
      inputTokensApprox: sumOptionalNumbers(
        sectionReceipts.map((receipt) => receiptInputTokens(receipt)),
      ),
      outputTokensApprox: sumOptionalNumbers(
        sectionReceipts.map((receipt) => receiptOutputTokens(receipt)),
      ),
      durationMs: sectionReceipts.reduce((sum, receipt) => sum + receiptDurationMs(receipt), 0),
      sectionCount: scriptSectionPlans.length,
      prompt: createPromptProvenance(
        prompt.key,
        promptTexts.join("\n\n---\n\n"),
        "script.md",
        prompt.source,
      ),
    };
    await enforceBudget({
      run,
      config,
      stage: "script",
      provider: meta.provider,
      model: meta.model,
      estimatedUsd,
      inputTokens: meta.inputTokensApprox,
      outputTokens: meta.outputTokensApprox,
      durationMs: meta.durationMs,
    });
    run = await removeRunArtifact(run, "script", "diagnostics/script_generation_failure.json");
    run = await writeRunText(run, "script", "script.md", script);
    run = await writeRunJson(run, "script", "script.sections.json", {
      sectionCount: scriptSectionPlans.length,
      expansionChunkCount: scriptSectionExpansionChunks.length,
      providerCallCount: sectionProviderCallCount(sectionReceipts),
      sections: sectionReceipts,
    });
    run = await writeRunJson(run, "script", "script.meta.json", meta);
    await setRunState(run, "SCRIPT_GENERATED", "script");
    return meta;
  } catch (error) {
    run = await persistScriptGenerationFailure(run, config, error, generationReceipts);
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "script",
      message: (error as Error).message,
    });
    throw error;
  }
}

function sumOptionalNumbers(values: Array<number | undefined>): number | undefined {
  return values.every((value): value is number => typeof value === "number")
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;
}

function reviewBlockers(script: string) {
  return reviewScriptContent(script).filter((warning) => warning.severity === "blocker");
}
