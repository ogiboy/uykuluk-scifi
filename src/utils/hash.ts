import { createHash } from "node:crypto";

/**
 * Computes the SHA-256 hash of a string.
 *
 * @param value - The UTF-8 string to hash
 * @returns The SHA-256 hash encoded as a hexadecimal string
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
