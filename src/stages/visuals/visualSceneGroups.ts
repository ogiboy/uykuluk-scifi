import { sha256 } from "../../utils/hash.js";
import type { ProductionScene } from "../types.js";

export type VisualSceneGroup = Readonly<{
  sceneIndex: number;
  productionSceneIndexes: number[];
  durationSeconds: number;
  visualPrompt: string;
  promptDigest: string;
}>;

/** Groups narration scenes into 12-24 deterministic visual beats for episode pacing. */
export function groupProductionScenesForVisuals(
  scenes: readonly ProductionScene[],
): VisualSceneGroup[] {
  const totalDurationSeconds = scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
  const desired = Math.max(12, Math.min(24, Math.ceil(totalDurationSeconds / 30)));
  if (scenes.length <= desired) {
    return splitScenesIntoVisualBeats(scenes, desired);
  }
  return groupScenesIntoVisualBeats(scenes, desired);
}

function groupScenesIntoVisualBeats(
  scenes: readonly ProductionScene[],
  groupCount: number,
): VisualSceneGroup[] {
  return Array.from({ length: groupCount }, (_, groupIndex) => {
    const start = Math.floor((groupIndex * scenes.length) / groupCount);
    const end = Math.floor(((groupIndex + 1) * scenes.length) / groupCount);
    const group = scenes.slice(start, end);
    const productionSceneIndexes = group.map((scene) => scene.index);
    const visualPrompts = Array.from(new Set(group.map((scene) => scene.visualPrompt)));
    const durationSeconds = sumDuration(group);
    const visualPrompt = visualPrompts.join("\n\n");
    return {
      sceneIndex: groupIndex + 1,
      productionSceneIndexes,
      durationSeconds,
      visualPrompt,
      promptDigest: visualGroupPromptDigest(productionSceneIndexes, visualPrompt, durationSeconds),
    };
  });
}

function splitScenesIntoVisualBeats(
  scenes: readonly ProductionScene[],
  beatCount: number,
): VisualSceneGroup[] {
  const allocations = allocateBeatsByDuration(scenes, beatCount);
  const groups: VisualSceneGroup[] = [];
  for (const [sceneOffset, scene] of scenes.entries()) {
    const sceneBeatCount = allocations[sceneOffset] ?? 1;
    const durations = distributeDuration(scene.durationSeconds, sceneBeatCount);
    for (let beatOffset = 0; beatOffset < sceneBeatCount; beatOffset += 1) {
      const durationSeconds = durations[beatOffset] ?? 0;
      const focus = narrationFocus(scene.narration, beatOffset, sceneBeatCount);
      const visualPrompt =
        sceneBeatCount === 1
          ? scene.visualPrompt
          : `${scene.visualPrompt}\n\nBeat ${beatOffset + 1}/${sceneBeatCount} focus: ${focus}`;
      const productionSceneIndexes = [scene.index];
      groups.push({
        sceneIndex: groups.length + 1,
        productionSceneIndexes,
        durationSeconds,
        visualPrompt,
        promptDigest: visualGroupPromptDigest(
          productionSceneIndexes,
          visualPrompt,
          durationSeconds,
        ),
      });
    }
  }
  return groups;
}

function allocateBeatsByDuration(scenes: readonly ProductionScene[], beatCount: number): number[] {
  const allocations = scenes.map(() => 1);
  const remaining = beatCount - scenes.length;
  if (remaining <= 0) return allocations;
  const totalDuration = sumDuration(scenes);
  const quotas = scenes.map((scene) => (remaining * scene.durationSeconds) / totalDuration);
  const extras = quotas.map(Math.floor);
  let assigned = extras.reduce((total, value) => total + value, 0);
  const rankedRemainders = quotas
    .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const item of rankedRemainders) {
    if (assigned >= remaining) break;
    extras[item.index] = (extras[item.index] ?? 0) + 1;
    assigned += 1;
  }
  return allocations.map((value, index) => value + (extras[index] ?? 0));
}

function distributeDuration(durationSeconds: number, count: number): number[] {
  const base = durationSeconds / count;
  const durations = Array.from({ length: count }, () => base);
  const priorTotal = durations.slice(0, -1).reduce((total, duration) => total + duration, 0);
  durations[count - 1] = durationSeconds - priorTotal;
  return durations;
}

function narrationFocus(narration: string, index: number, count: number): string {
  const words = narration.trim().split(/\s+/u);
  const start = Math.floor((index * words.length) / count);
  const end = Math.max(start + 1, Math.floor(((index + 1) * words.length) / count));
  const selected = words.slice(start, end).join(" ");
  return selected || words[index % words.length] || narration;
}

function sumDuration(scenes: readonly ProductionScene[]): number {
  return scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
}

export function visualGroupPromptDigest(
  productionSceneIndexes: readonly number[],
  visualPrompt: string,
  durationSeconds: number,
): string {
  return sha256(JSON.stringify({ productionSceneIndexes, visualPrompt, durationSeconds }));
}
