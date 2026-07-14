import { SafeExitError } from "../../core/errors.js";
import {
  cleanScriptProductionText,
  parseScriptProductionUnits,
  type ScriptProductionUnit,
} from "../../utils/scriptProductionText.js";
import type { ProductionScene } from "../types.js";
import { voiceSubtitleThresholds } from "../voice/subtitles/voiceSubtitleContracts.js";

type SceneDraft = { narration: string; visuals: string[] };

type SubtitleBlock = { lines: string[]; weight: number };

const maxSubtitleLineLength = voiceSubtitleThresholds.maxCharactersPerLine;
const maxSubtitleLinesPerCue = voiceSubtitleThresholds.maxLinesPerCue;

/**
 * Extracts spoken narration from a labeled script.
 *
 * Visual directions stay out of the TTS/subtitle source and are preserved as scene prompts.
 *
 * @param script - The approved script markdown.
 * @returns Scene records with spoken narration and visual prompts.
 */
export function buildProductionScenesFromScript(script: string): ProductionScene[] {
  const units = parseScriptProductionUnits(script);
  const drafts = buildSceneDrafts(units);
  const fallbackText = cleanScriptProductionText(script);
  const sceneDrafts =
    drafts.length > 0
      ? drafts
      : [{ narration: fallbackText, visuals: [`Cinematic UykulukSciFi scene: ${fallbackText}`] }];

  return sceneDrafts.map((scene, index) => ({
    index: index + 1,
    narration: scene.narration,
    visualPrompt: renderVisualPrompt(index + 1, scene),
    durationSeconds: Math.max(7, Math.round(scene.narration.split(/\s+/u).length / 2.3)),
  }));
}

/**
 * Renders readable SRT cues from production scenes.
 *
 * Long narration is split into timed, wrapped cue blocks so FFmpeg subtitle burn-in does not create
 * oversized single-cue overlays.
 *
 * @param scenes - Production scenes derived from the approved script.
 * @returns SRT subtitle text.
 */
export function buildWrappedSrt(scenes: readonly ProductionScene[]): string {
  let cursor = 0;
  let cueIndex = 1;
  const cues: string[] = [];

  for (const scene of scenes) {
    const blocks = subtitleBlocks(scene.narration);
    const sceneStart = cursor;
    const sceneEnd = cursor + scene.durationSeconds;
    const durations = readableCueDurations(blocks, scene.durationSeconds);
    let cueStart = sceneStart;

    for (const [blockIndex, block] of blocks.entries()) {
      const start = cueStart;
      const end =
        blockIndex === blocks.length - 1 ? sceneEnd : start + (durations[blockIndex] ?? 0);
      cues.push(
        [
          String(cueIndex),
          `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
          block.lines.join("\n"),
          "",
        ].join("\n"),
      );
      cueIndex += 1;
      cueStart = end;
    }
    cursor = sceneEnd;
  }

  return cues.join("\n");
}

function readableCueDurations(
  blocks: readonly SubtitleBlock[],
  sceneDurationSeconds: number,
): number[] {
  const totalWeight = blocks.reduce((sum, block) => sum + block.weight, 0) || 1;
  const minimums = blocks.map((block) =>
    Math.max(
      voiceSubtitleThresholds.minCueDurationSeconds,
      Array.from(block.lines.join("")).length / voiceSubtitleThresholds.maxCharactersPerSecond,
    ),
  );
  if (minimums.some((minimum) => minimum > voiceSubtitleThresholds.maxCueDurationSeconds)) {
    throw new SafeExitError(
      "Production subtitle text cannot fit within the maximum readable cue duration.",
    );
  }
  const durations = blocks.map((block, index) =>
    Math.min(
      voiceSubtitleThresholds.maxCueDurationSeconds,
      Math.max(minimums[index] ?? 0, (sceneDurationSeconds * block.weight) / totalWeight),
    ),
  );
  rebalanceCueDurations(
    durations,
    minimums,
    sceneDurationSeconds,
    voiceSubtitleThresholds.maxCueDurationSeconds,
  );
  return durations;
}

function rebalanceCueDurations(
  durations: number[],
  minimums: readonly number[],
  targetSeconds: number,
  maximumSeconds: number,
): void {
  const currentTotal = durations.reduce((sum, duration) => sum + duration, 0);
  const delta = targetSeconds - currentTotal;
  const capacities = durations.map((duration, index) =>
    delta >= 0 ? maximumSeconds - duration : duration - (minimums[index] ?? 0),
  );
  const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (Math.abs(delta) > totalCapacity + voiceSubtitleThresholds.timingToleranceSeconds) {
    throw new SafeExitError("Production subtitle timing cannot satisfy readable cue thresholds.");
  }
  if (Math.abs(delta) <= voiceSubtitleThresholds.timingToleranceSeconds) return;
  for (let index = 0; index < durations.length; index += 1) {
    const capacity = capacities[index] ?? 0;
    if (capacity <= 0 || totalCapacity <= 0) continue;
    durations[index] = (durations[index] ?? 0) + (delta * capacity) / totalCapacity;
  }
}

export function renderVoiceoverText(scenes: readonly ProductionScene[]): string {
  return scenes.map((scene) => scene.narration).join("\n\n");
}

function buildSceneDrafts(units: readonly ScriptProductionUnit[]): SceneDraft[] {
  const scenes: SceneDraft[] = [];
  const pendingVisuals: string[] = [];
  let current: SceneDraft | undefined;

  for (const unit of units) {
    if (unit.label === "visual") {
      if (current) {
        current.visuals.push(unit.text);
      } else {
        pendingVisuals.push(unit.text);
      }
      continue;
    }
    if (current) {
      scenes.push(current);
    }
    current = { narration: unit.text, visuals: pendingVisuals.splice(0) };
  }

  if (current) {
    scenes.push(current);
  }
  return scenes;
}

function subtitleBlocks(text: string): SubtitleBlock[] {
  const sentences = splitSentences(text);
  const blocks: SubtitleBlock[] = [];
  let currentLines: string[] = [];

  for (const sentence of sentences) {
    const sentenceLines = wrapSubtitleLines(sentence);
    if (sentenceLines.length > maxSubtitleLinesPerCue) {
      flushLines(blocks, currentLines);
      currentLines = [];
      for (let index = 0; index < sentenceLines.length; index += maxSubtitleLinesPerCue) {
        flushLines(blocks, sentenceLines.slice(index, index + maxSubtitleLinesPerCue));
      }
      continue;
    }
    if (currentLines.length + sentenceLines.length > maxSubtitleLinesPerCue) {
      flushLines(blocks, currentLines);
      currentLines = [];
    }
    currentLines.push(...sentenceLines);
  }

  flushLines(blocks, currentLines);
  return blocks.length > 0 ? blocks : [{ lines: [text], weight: text.length || 1 }];
}

function splitSentences(text: string): string[] {
  return text
    .replaceAll(/\s+/gu, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function wrapSubtitleLines(text: string): string[] {
  const words = text.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxSubtitleLineLength || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function flushLines(blocks: SubtitleBlock[], lines: readonly string[]): void {
  if (lines.length === 0) {
    return;
  }
  blocks.push({ lines: [...lines], weight: lines.join(" ").length || 1 });
}

function renderVisualPrompt(sceneIndex: number, scene: SceneDraft): string {
  const visualText = scene.visuals.join(" ");
  const source = visualText || boundedSceneText(scene.narration, 180);
  return `Cinematic UykulukSciFi scene ${sceneIndex}: ${source}`;
}

function boundedSceneText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const prefix = value.slice(0, maxLength + 1);
  const boundary = Math.max(
    prefix.lastIndexOf(". "),
    prefix.lastIndexOf("! "),
    prefix.lastIndexOf("? "),
  );
  const wordBoundary = prefix.lastIndexOf(" ");
  const cutAt = boundary >= Math.floor(maxLength * 0.55) ? boundary + 1 : wordBoundary;
  return `${prefix.slice(0, Math.max(1, cutAt)).trim()}…`;
}

function formatSrtTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const totalMillis = Math.round(safeSeconds * 1000);
  const hrs = Math.floor(totalMillis / 3_600_000);
  const mins = Math.floor((totalMillis % 3_600_000) / 60_000);
  const secs = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}
