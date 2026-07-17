import { readFile } from "node:fs/promises";
import type { VisualMutationExpectation } from "../stages/visuals.js";
import {
  visualActiveRevisionExpectationsSchema,
  visualMutationExpectationSchema,
} from "../stages/visuals/visualMutationExpectation.js";

export type VisualMutationCliOptions = Readonly<{
  expectedActiveRevisionsFile: string;
  expectedManifestDigest: string;
  json?: boolean;
  run: string;
}>;

export async function readVisualMutationExpectation(
  options: VisualMutationCliOptions,
): Promise<VisualMutationExpectation> {
  const expectedActiveRevisions = visualActiveRevisionExpectationsSchema.parse(
    JSON.parse(await readFile(options.expectedActiveRevisionsFile, "utf8")) as unknown,
  );
  return visualMutationExpectationSchema.parse({
    expectedManifestDigest: options.expectedManifestDigest,
    expectedActiveRevisions,
  });
}

export async function readRequiredVisualMutationExpectation(options: {
  expectedActiveRevisionsFile?: string;
  expectedManifestDigest?: string;
}): Promise<VisualMutationExpectation> {
  if (!options.expectedActiveRevisionsFile || !options.expectedManifestDigest) {
    throw new Error(
      "Rejected hosted regeneration requires the expected manifest digest and active revisions file.",
    );
  }
  return readVisualMutationExpectation({
    expectedActiveRevisionsFile: options.expectedActiveRevisionsFile,
    expectedManifestDigest: options.expectedManifestDigest,
    run: "unused",
  });
}

export function positiveSceneIndex(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Scene index must be a positive integer.");
  }
  return parsed;
}

export function parseSceneIndexes(
  value: string,
  scenes: ReadonlyArray<{ sceneIndex: number }>,
): number[] {
  if (value.trim().toLowerCase() === "all") {
    return scenes.map((scene) => scene.sceneIndex);
  }
  return Array.from(new Set(value.split(",").map((item) => positiveSceneIndex(item.trim()))));
}

export function decisionStatus(value: string): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") return value;
  throw new Error("Visual decision must be approved or rejected.");
}

export function hostedPlanPurpose(value: string): "initial" | "regenerate-rejected" {
  if (value === "initial" || value === "regenerate-rejected") return value;
  throw new Error("Hosted visual plan purpose must be initial or regenerate-rejected.");
}

export function parseExplicitSceneIndexes(value: string): number[] {
  const scenes = Array.from(
    new Set(value.split(",").map((item) => positiveSceneIndex(item.trim()))),
  );
  if (scenes.length === 0 || scenes.length > 24) {
    throw new Error("Hosted visual plans require 1-24 explicit scene indexes.");
  }
  return scenes;
}
