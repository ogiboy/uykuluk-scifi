import { canonicalJsonDigest } from "../../utils/canonicalJsonDigest.js";

/** Computes a stable digest for validated hosted-visual plan evidence. */
export function canonicalVisualGenerationDigest(value: unknown): string {
  return canonicalJsonDigest(value, {
    nonFiniteNumber: "Canonical visual generation evidence requires finite numbers.",
    unsupportedValue: "Canonical visual generation evidence contains an unsupported value.",
  });
}
