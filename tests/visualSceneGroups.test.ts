import { describe, expect, it } from "vitest";
import type { ProductionScene } from "../src/stages/types";
import { groupProductionScenesForVisuals } from "../src/stages/visuals/visualSceneGroups";

function scene(index: number, durationSeconds: number): ProductionScene {
  return {
    index,
    durationSeconds,
    narration: `Episode-specific narration for production scene ${index} with enough words to split deterministically across visual beats.`,
    visualPrompt: `Cinematic visual prompt for scene ${index}`,
  };
}

describe("visual scene grouping", () => {
  it("splits a short production package into 12 contiguous deterministic beats", () => {
    const groups = groupProductionScenesForVisuals([scene(1, 36)]);

    expect(groups).toHaveLength(12);
    expect(groups.map((group) => group.sceneIndex)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(groups.every((group) => group.productionSceneIndexes[0] === 1)).toBe(true);
    expect(new Set(groups.map((group) => group.visualPrompt)).size).toBe(12);
    expect(groups.reduce((total, group) => total + group.durationSeconds, 0)).toBe(36);
  });

  it("groups more than 24 production scenes without reordering or losing duration", () => {
    const scenes = Array.from({ length: 30 }, (_, index) => scene(index + 1, index + 1));
    const groups = groupProductionScenesForVisuals(scenes);

    expect(groups).toHaveLength(16);
    expect(groups.flatMap((group) => group.productionSceneIndexes)).toEqual(
      scenes.map((item) => item.index),
    );
    expect(groups.reduce((total, group) => total + group.durationSeconds, 0)).toBe(465);
  });
});
