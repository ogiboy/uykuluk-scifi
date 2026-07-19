import { createHash } from "node:crypto";
import type { DraftSubtitleTimingMode } from "./renderSubtitleTiming.js";

/** Digest-bound approval helpers for local render inputs. */

export type RenderApprovalRefV3Input = {
  renderPlanDigest: string;
  visualManifestDigest: string;
  subtitleDigest: string;
  subtitleMetadataDigest: string;
  subtitleTimingMode: DraftSubtitleTimingMode;
  voiceMetadataDigest: string;
  voiceoverAudioDigest: string;
  voiceoverMode: string;
  voiceoverProductionVoiceCandidate: boolean;
  voiceoverQuality: string;
};

export type RenderApprovalRefV4Input = RenderApprovalRefV3Input & {
  soundtrackManifestDigest: string;
};

/** Computes the legacy v3 render-approval reference for compatibility checks. */
export function renderApprovalRefV3(input: RenderApprovalRefV3Input): string {
  return createHash("sha256")
    .update(JSON.stringify({ contractVersion: 3, ...input }), "utf8")
    .digest("hex");
}

/**
 * Computes a stable approval reference for a render input.
 *
 * @param input - The render approval input to hash
 * @returns The SHA-256 digest of the serialized input as a hexadecimal string
 */
export function renderApprovalRefV4(input: RenderApprovalRefV4Input): string {
  return createHash("sha256")
    .update(JSON.stringify({ contractVersion: 4, ...input }), "utf8")
    .digest("hex");
}

/** Computes the current v4 approval reference for render inputs. */
export const renderApprovalRef = renderApprovalRefV4;
