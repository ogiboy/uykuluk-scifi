import { canonicalJsonDigest } from "../../../utils/canonicalJsonDigest.js";

/**
 * Computes a key-order-independent SHA-256 digest for JSON voice evidence.
 *
 * @param value - The evidence value to canonicalize and digest
 * @returns The SHA-256 digest of the canonicalized evidence
 */
export function canonicalVoiceEvidenceDigest(value: unknown): string {
  return canonicalJsonDigest(value, {
    nonFiniteNumber: "Canonical voice evidence cannot contain a non-finite number.",
    unsupportedValue: "Canonical voice evidence contains an unsupported value.",
  });
}
