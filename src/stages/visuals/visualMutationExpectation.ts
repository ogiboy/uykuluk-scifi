import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";
import { digestSchema } from "../render/renderPlanSchemas.js";
import type { LoadedVisualManifest } from "./visualManifest.js";

export const visualActiveRevisionExpectationsSchema = z
  .array(
    z.strictObject({ sceneIndex: z.int().positive().max(24), activeRevision: z.int().positive() }),
  )
  .min(12)
  .max(24);

export const visualMutationExpectationSchema = z.strictObject({
  expectedManifestDigest: digestSchema,
  expectedActiveRevisions: visualActiveRevisionExpectationsSchema,
});

export type VisualMutationExpectation = Readonly<z.infer<typeof visualMutationExpectationSchema>>;

export function assertVisualMutationExpectation(
  loaded: LoadedVisualManifest,
  expectation: VisualMutationExpectation,
): void {
  if (!expectation.expectedManifestDigest) {
    throw new SafeExitError(
      "Visual mutation requires the expected manifest digest and active revisions.",
    );
  }
  if (expectation.expectedManifestDigest !== loaded.digest) {
    throw new SafeExitError("Visual manifest changed; reload before retrying this mutation.");
  }
  const expected = new Map(
    expectation.expectedActiveRevisions.map((item) => [item.sceneIndex, item.activeRevision]),
  );
  if (
    expected.size !== expectation.expectedActiveRevisions.length ||
    expected.size !== loaded.manifest.scenes.length
  ) {
    throw new SafeExitError(
      "Expected active visual revisions must include every scene exactly once.",
    );
  }
  for (const scene of loaded.manifest.scenes) {
    if (expected.get(scene.sceneIndex) !== scene.activeRevision) {
      throw new SafeExitError(
        `Visual scene ${scene.sceneIndex} changed revision; reload before retrying this mutation.`,
      );
    }
  }
}
