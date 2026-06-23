import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { SafeExitError } from "../core/errors.js";
import { defaultStagePricing } from "../costs/pricing.js";
import { enforceBudget } from "../safeguards/budgetGuard.js";
import { reviewScriptContent } from "../safeguards/contentGuard.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { createLlmProvider } from "../providers/index.js";
import { createPromptProvenance } from "../prompts/provenance.js";
import { renderScriptPrompt } from "../prompts/templates.js";
import { stripProviderThinking } from "./providerPayloads.js";
import {
  assembleScriptFromSections,
  createScriptSectionReceipt,
  parseScriptSectionProviderPayload,
  renderScriptSectionPrompt,
  scriptSectionResponseFormat,
  scriptSectionPlans,
  sectionTokenCap,
} from "./scriptSections.js";
import { ScriptMeta, VideoIdea } from "./types.js";

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
    const sectionCap = sectionTokenCap(config.providers.llm.maxOutputTokens.script);
    const sectionOutputs = [];
    const sectionReceipts = [];
    for (const section of scriptSectionPlans) {
      const sectionPrompt = renderScriptSectionPrompt(prompt.text, section);
      const result = await provider.generateText({
        model: config.providers.llm.model,
        temperature: 0.6,
        maxTokens: sectionCap,
        responseFormat: scriptSectionResponseFormat,
        prompt: sectionPrompt,
      });
      const text = stripProviderThinking(parseScriptSectionProviderPayload(result.text));
      assertNoScriptBlockers(text);
      sectionOutputs.push({ heading: section.heading, text });
      sectionReceipts.push(createScriptSectionReceipt(section, sectionPrompt, text, result));
    }
    const script = assembleScriptFromSections(idea.title, sectionOutputs);
    assertNoScriptBlockers(script);
    const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
    const meta: ScriptMeta = {
      estimatedDuration: `${Math.max(1, Math.round(wordCount / 135))}-${Math.max(2, Math.round(wordCount / 115))} dakika`,
      wordCount,
      tone: config.channel.defaultTone,
      claimsRequiringFactCheck: extractClaims(script),
      possibleVisualBeats: extractVisualBeats(script),
      provider: sectionReceipts[0]?.provider ?? "unknown",
      model: sectionReceipts[0]?.model ?? config.providers.llm.model,
      inputTokensApprox: sumOptionalNumbers(
        sectionReceipts.map((receipt) => receipt.inputTokensApprox),
      ),
      outputTokensApprox: sumOptionalNumbers(
        sectionReceipts.map((receipt) => receipt.outputTokensApprox),
      ),
      durationMs: sectionReceipts.reduce((sum, receipt) => sum + receipt.durationMs, 0),
      sectionCount: sectionReceipts.length,
      prompt: createPromptProvenance(
        prompt.key,
        scriptSectionPlans
          .map((section) => renderScriptSectionPrompt(prompt.text, section))
          .join("\n\n---\n\n"),
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
    run = await writeRunText(run, "script", "script.md", script);
    run = await writeRunJson(run, "script", "script.sections.json", {
      sectionCount: sectionReceipts.length,
      sections: sectionReceipts,
    });
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

function assertNoScriptBlockers(script: string): void {
  const blockerCodes = reviewScriptContent(script)
    .filter((warning) => warning.severity === "blocker")
    .map((warning) => warning.code);
  if (blockerCodes.length > 0) {
    throw new SafeExitError(
      `Invalid script provider response: blocking findings: ${blockerCodes.join(", ")}.`,
    );
  }
}

function sumOptionalNumbers(values: Array<number | undefined>): number | undefined {
  return values.every((value): value is number => typeof value === "number")
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;
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
