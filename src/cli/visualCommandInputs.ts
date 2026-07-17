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

/**
 * Loads and validates the expected visual mutation state from a revisions file.
 *
 * @param options - File path and manifest digest used to construct the expectation
 * @returns The validated visual mutation expectation
 */
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

/**
 * Loads the expected visual mutation state required for hosted regeneration.
 *
 * @param options - File and manifest digest inputs used to validate the expected state
 * @returns The validated visual mutation expectation
 * @throws Error if the expected active revisions file or manifest digest is missing
 */
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

/**
 * Validates and converts a scene index from its command-line representation.
 *
 * @param value - The scene index to validate.
 * @returns The positive safe integer represented by `value`.
 * @throws Error if `value` does not represent a positive safe integer.
 */
export function positiveSceneIndex(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Scene index must be a positive integer.");
  }
  return parsed;
}

/**
 * Parses a scene index selection from a comma-separated value or selects all provided scenes.
 *
 * @param value - A comma-separated list of positive scene indexes, or `all`
 * @param scenes - Scenes whose indexes are selected when `value` is `all`
 * @returns The selected scene indexes, with duplicate indexes removed
 */
export function parseSceneIndexes(
  value: string,
  scenes: ReadonlyArray<{ sceneIndex: number }>,
): number[] {
  if (value.trim().toLowerCase() === "all") {
    return scenes.map((scene) => scene.sceneIndex);
  }
  return Array.from(new Set(value.split(",").map((item) => positiveSceneIndex(item.trim()))));
}

/**
 * Validates a visual decision status.
 *
 * @param value - The decision status to validate.
 * @returns `value` when it is `"approved"` or `"rejected"`.
 * @throws Error if `value` is not `"approved"` or `"rejected"`.
 */
export function decisionStatus(value: string): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") return value;
  throw new Error("Visual decision must be approved or rejected.");
}

/**
 * Validates the purpose of a hosted visual plan.
 *
 * @param value - The requested plan purpose.
 * @returns The validated purpose.
 * @throws If `value` is not `"initial"` or `"regenerate-rejected"`.
 */
export function hostedPlanPurpose(value: string): "initial" | "regenerate-rejected" {
  if (value === "initial" || value === "regenerate-rejected") return value;
  throw new Error("Hosted visual plan purpose must be initial or regenerate-rejected.");
}

/**
 * Parses and validates the explicit scene indexes for a hosted visual plan.
 *
 * @param value - A comma-separated list of positive scene indexes.
 * @returns The unique scene indexes in their input order.
 * @throws Error if the list contains fewer than 1 or more than 24 unique indexes.
 */
export function parseExplicitSceneIndexes(value: string): number[] {
  const scenes = Array.from(
    new Set(value.split(",").map((item) => positiveSceneIndex(item.trim()))),
  );
  if (scenes.length === 0 || scenes.length > 24) {
    throw new Error("Hosted visual plans require 1-24 explicit scene indexes.");
  }
  return scenes;
}
