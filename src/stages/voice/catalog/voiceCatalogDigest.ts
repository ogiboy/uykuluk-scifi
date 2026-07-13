import { sha256 } from "../../../utils/hash.js";

/**
 * Computes a key-order-independent SHA-256 digest for validated JSON evidence.
 *
 * @param value - The JSON evidence to digest
 * @returns The SHA-256 digest of the canonicalized evidence
 */
export function canonicalVoiceEvidenceDigest(value: unknown): string {
  return sha256(canonicalJson(value));
}

/**
 * Produces a deterministic JSON representation of validated voice evidence.
 *
 * Object keys are sorted, array order is preserved, and properties with `undefined` values are omitted.
 *
 * @param value - The evidence value to canonicalize
 * @returns The canonical JSON representation
 * @throws TypeError If the value contains a non-finite number or an unsupported type
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical voice evidence cannot contain a non-finite number.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("Canonical voice evidence contains an unsupported value.");
}
