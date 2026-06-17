import { readFile } from "node:fs/promises";
import { loadConfig } from "../config/config";
import { artifactPath, writeRunJson, writeRunText } from "../core/artifacts";
import { SafeExitError } from "../core/errors";
import { appendLedgerEvent } from "../core/ledger";
import { loadRun, setRunState } from "../core/runStore";
import { assertTransition } from "../core/transitions";
import { checkBudget } from "../safeguards/budgetGuard";
import { requireApproval, requireState } from "../safeguards/approvalGuard";
import { createLlmProvider } from "../providers";
import { sha256 } from "../utils/hash";
import { ProductionScene } from "./types";

type PackageProviderPayload = {
  popupCards: string[];
  lowerThirds: string[];
  youtube: {
    title: string;
    description: string;
    tags: string[];
  };
};

export async function generateProductionPackage(runId: string): Promise<void> {
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
    const provider = createLlmProvider(config);
    const result = await provider.generateText({
      model: config.providers.llm.model,
      prompt: [
        "PRODUCTION_PACKAGE_JSON",
        "Create popup cards, lower thirds, and YouTube metadata.",
        script,
      ].join("\n"),
    });
    const providerPayload = JSON.parse(result.text) as PackageProviderPayload;
    const voiceover = cleanVoiceover(script);
    const scenes = buildScenes(voiceover);
    const subtitles = buildSrt(scenes);
    const packageMarkdown = renderPackageMarkdown(providerPayload, scenes);
    await checkBudget({
      run,
      config,
      stage: "package",
      provider: result.provider,
      model: result.model,
      estimatedUsd: 0,
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
    await setRunState(run, "PRODUCTION_PACKAGE_GENERATED", "package");
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

function cleanVoiceover(script: string): string {
  return script
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildScenes(voiceover: string): ProductionScene[] {
  const chunks = voiceover
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.map((chunk, index) => ({
    index: index + 1,
    narration: chunk,
    visualPrompt: `Cinematic UykulukSciFi scene ${index + 1}: ${chunk.slice(0, 180)}`,
    durationSeconds: Math.max(8, Math.round(chunk.split(/\s+/).length / 2.3)),
  }));
}

function buildSrt(scenes: ProductionScene[]): string {
  let cursor = 0;
  return scenes
    .map((scene) => {
      const start = cursor;
      const end = cursor + scene.durationSeconds;
      cursor = end;
      return [
        String(scene.index),
        `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
        scene.narration,
        "",
      ].join("\n");
    })
    .join("\n");
}

function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},000`;
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
