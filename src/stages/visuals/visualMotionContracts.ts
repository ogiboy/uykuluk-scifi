import { z } from "zod";

export const visualMotionPresetSchema = z.strictObject({
  kind: z.enum(["slow-zoom-in", "slow-zoom-out", "slow-pan-left", "slow-pan-right"]),
  pan: z.enum(["center", "left", "right"]),
  seed: z.int().nonnegative(),
  zoomEnd: z.number().min(1).max(1.2),
  zoomStart: z.number().min(1).max(1.2),
});

export type VisualMotionPreset = z.infer<typeof visualMotionPresetSchema>;
