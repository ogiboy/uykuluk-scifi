import type { VisualMotionPreset } from "./visualContracts.js";

const motionPresets: readonly Omit<VisualMotionPreset, "seed">[] = [
  { kind: "slow-zoom-in", pan: "center", zoomStart: 1, zoomEnd: 1.08 },
  { kind: "slow-pan-left", pan: "left", zoomStart: 1.08, zoomEnd: 1.08 },
  { kind: "slow-zoom-out", pan: "center", zoomStart: 1.08, zoomEnd: 1 },
  { kind: "slow-pan-right", pan: "right", zoomStart: 1.08, zoomEnd: 1.08 },
];

/** Assigns a reproducible motion preset to a scene revision. */
export function deterministicVisualMotion(
  sceneIndex: number,
  revision: number,
): VisualMotionPreset {
  const seed = sceneIndex * 10_000 + revision;
  const preset = motionPresets[(sceneIndex + revision - 2) % motionPresets.length];
  if (!preset) {
    throw new Error("Visual motion preset table is empty.");
  }
  return { ...preset, seed };
}
