import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config.js";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts.js";
import { SafeExitError } from "../core/errors.js";
import { appendLedgerEvent } from "../core/ledger.js";
import { loadRun, setRunState } from "../core/runStore.js";
import { assertTransition } from "../core/transitions.js";
import { defaultStagePricing } from "../costs/pricing.js";
import { createPromptProvenance } from "../prompts/provenance.js";
import { renderProductionPackagePrompt } from "../prompts/templates.js";
import { createLlmProvider } from "../providers/index.js";
import { requireApproval, requireState } from "../safeguards/approvalGuard.js";
import { enforceBudget } from "../safeguards/budgetGuard.js";
import { scriptLongFormWordFloor } from "../safeguards/scriptLengthContract.js";
import { sha256 } from "../utils/hash.js";
import { countSpokenNarrationWords } from "../utils/scriptProductionText.js";
import {
  createProductionPackageManifest,
  type ProductionPackageManifest,
} from "./production/productionPackageIntegrity.js";
import { assertProductionPackageProviderQuality } from "./production/productionPackageProviderQuality.js";
import {
  buildProductionScenesFromScript,
  buildWrappedSrt,
  renderVoiceoverText,
} from "./production/productionPackageScript.js";
import {
  PackageProviderPayload,
  parseProductionPackageProviderPayload,
} from "./provider/providerPayloads.js";
import { productionPackageResponseFormat } from "./provider/providerResponseFormats.js";
import { ProductionScene } from "./types.js";

/**
 * Generates production assets from an approved script with script integrity validation and budget enforcement.
 *
 * Verifies that the current script matches the approved script by hash comparison, enforces budget constraints before and after LLM generation, and persists generated voiceover, subtitles, scenes, YouTube metadata, and production package documentation. Records a run state transition to "PRODUCTION_PACKAGE_GENERATED" upon completion.
 *
 * @param runId - The run identifier
 * @returns The persisted production package manifest.
 * @throws Throws if the script content has changed since approval or if budget limits are exceeded.
 */
export async function generateProductionPackage(runId: string): Promise<ProductionPackageManifest> {
  const config = await loadConfig();
  let run = await loadRun(runId);
  await requireState(run, "SCRIPT_APPROVED", "package");
  await requireApproval(run, "script", "package");
  assertTransition(run.state, "PRODUCTION_PACKAGE_GENERATED");
  try {
    const script = await readFile(artifactPath(run.runId, "script.md"), "utf8");
    const approval = run.approvals.find(
      (item) => item.runId === run.runId && item.target === "script",
    );
    const scriptHash = sha256(script);
    if (!approval?.approvedRef || approval.approvedRef !== scriptHash) {
      await appendLedgerEvent({
        runId: run.runId,
        type: "GUARD_BLOCKED",
        stage: "package",
        message: "Script content hash does not match the approved script.",
        data: { approvedHash: approval?.approvedRef ?? null, currentHash: scriptHash },
      });
      throw new SafeExitError("Blocked: script changed after approval.");
    }
    const narrationWordCount = countSpokenNarrationWords(script);
    if (narrationWordCount < scriptLongFormWordFloor) {
      await appendLedgerEvent({
        runId: run.runId,
        type: "GUARD_BLOCKED",
        stage: "package",
        message: "Approved script spoken narration is below the production duration floor.",
        data: { narrationWordCount, requiredNarrationWordCount: scriptLongFormWordFloor },
      });
      throw new SafeExitError(
        `Blocked: approved script spoken narration is below the production floor (${narrationWordCount}/${scriptLongFormWordFloor} words); revise and re-approve the script before packaging.`,
      );
    }
    const estimatedUsd = defaultStagePricing.package.estimatedUsd;
    await enforceBudget({
      run,
      config,
      stage: "package",
      provider: defaultStagePricing.package.provider,
      estimatedUsd,
      recordCostEvent: false,
    });
    const provider = createLlmProvider(config);
    const prompt = await renderProductionPackagePrompt(script);
    const result = await provider.generateText({
      model: config.providers.llm.model,
      maxTokens: config.providers.llm.maxOutputTokens.productionPackage,
      responseFormat: productionPackageResponseFormat,
      prompt: prompt.text,
    });
    const providerPayload = parseProductionPackageProviderPayload(result.text);
    assertProductionPackageProviderQuality(providerPayload, script);
    const scenes = buildProductionScenesFromScript(script);
    const voiceover = renderVoiceoverText(scenes);
    const subtitles = buildWrappedSrt(scenes);
    const packageMarkdown = renderPackageMarkdown(providerPayload, scenes);
    const promptProvenance = createPromptProvenance(
      prompt.key,
      prompt.text,
      "production/production_package.md",
      prompt.source,
    );
    await enforceBudget({
      run,
      config,
      stage: "package",
      provider: result.provider,
      model: result.model,
      estimatedUsd,
      inputTokens: result.inputTokensApprox,
      outputTokens: result.outputTokensApprox,
      durationMs: result.durationMs,
    });
    run = await writeRunText(run, "package", "production/voiceover.txt", voiceover);
    run = await writeRunText(run, "package", "production/subtitles.srt", subtitles);
    run = await writeRunJson(run, "package", "production/scenes.json", { scenes });
    run = await writeRunJson(
      run,
      "package",
      "production/youtube_metadata.json",
      providerPayload.youtube,
    );
    run = await writeRunText(run, "package", "production/production_package.md", packageMarkdown);
    const manifest = await createProductionPackageManifest(run, scriptHash, {
      provider: result.provider,
      model: result.model,
      inputTokensApprox: result.inputTokensApprox,
      outputTokensApprox: result.outputTokensApprox,
      durationMs: result.durationMs,
      prompt: promptProvenance,
    });
    run = await writeRunJson(run, "package", "production/production_package.meta.json", manifest);
    await setRunState(run, "PRODUCTION_PACKAGE_GENERATED", "package");
    return manifest;
  } catch (error) {
    await appendLedgerEvent({
      runId: run.runId,
      type: "ERROR",
      stage: "package",
      message: (error as Error).message,
    });
    throw error;
  }
}

function renderPackageMarkdown(payload: PackageProviderPayload, scenes: ProductionScene[]): string {
  return [
    "# Production Package",
    "",
    "## Popup Cards",
    "",
    ...payload.popupCards.map((card) => `- ${card}`),
    "",
    "## Lower Thirds",
    "",
    ...payload.lowerThirds.map((item) => `- ${item}`),
    "",
    "## Scenes",
    "",
    ...scenes.map((scene) => `### Scene ${scene.index}\n\n${scene.visualPrompt}\n`),
    "",
    "## YouTube Draft",
    "",
    `Title: ${payload.youtube.title}`,
    "",
    payload.youtube.description,
    "",
    `Tags: ${payload.youtube.tags.join(", ")}`,
  ].join("\n");
}
