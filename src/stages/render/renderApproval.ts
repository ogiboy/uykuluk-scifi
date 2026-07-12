import { createHash } from "node:crypto";

/** Digest-bound approval helpers for local render inputs. */

export type RenderApprovalRefInput = {
  renderPlanDigest: string;
  voiceoverAudioDigest: string;
  voiceoverMode: string;
  voiceoverProductionVoiceCandidate: boolean;
  voiceoverQuality: string;
};

/**
 * Computes a stable approval reference for a render input.
 *
 * @param input - The render approval input to hash
 * @returns The SHA-256 digest of the serialized input as a hexadecimal string
 */
export function renderApprovalRef(input: RenderApprovalRefInput): string {
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}
