import { sha256 } from "./hash.js";

export type CanonicalJsonErrorMessages = Readonly<{
  nonFiniteNumber: string;
  unsupportedValue: string;
}>;

/** Computes a key-order-independent SHA-256 digest for JSON-compatible evidence. */
export function canonicalJsonDigest(value: unknown, messages: CanonicalJsonErrorMessages): string {
  return sha256(canonicalJson(value, messages));
}

function canonicalJson(value: unknown, messages: CanonicalJsonErrorMessages): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(messages.nonFiniteNumber);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item, messages)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], messages)}`)
      .join(",")}}`;
  }
  throw new TypeError(messages.unsupportedValue);
}
