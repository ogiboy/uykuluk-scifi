import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ThumbnailCandidatePack } from "./thumbnailCandidateContracts.js";

/**
 * Checks whether the thumbnail assets referenced by a candidate pack still match their digests.
 *
 * @param pack - The thumbnail candidate pack to verify.
 * @param root - The project root that contains the referenced asset paths.
 * @returns A stale reason when any referenced thumbnail asset is missing or changed.
 */
export async function thumbnailAssetStaleReason(
  pack: ThumbnailCandidatePack,
  root = process.cwd(),
): Promise<string | null> {
  for (const candidate of pack.candidates) {
    const templateStale = await assetDigestMismatch(
      root,
      candidate.template.path,
      candidate.template.digest,
    );
    if (templateStale) {
      return templateStale;
    }
    if (candidate.textSafeOverlay) {
      const overlayStale = await assetDigestMismatch(
        root,
        candidate.textSafeOverlay.path,
        candidate.textSafeOverlay.digest,
      );
      if (overlayStale) {
        return overlayStale;
      }
    }
  }
  return null;
}

async function assetDigestMismatch(
  root: string,
  relativePath: string,
  expectedDigest: string,
): Promise<string | null> {
  let bytes;
  try {
    bytes = await readFile(path.join(root, relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return `Thumbnail asset is missing: ${relativePath}`;
    }
    throw error;
  }
  const currentDigest = createHash("sha256").update(bytes).digest("hex");
  return currentDigest === expectedDigest
    ? null
    : `Thumbnail asset changed since handoff candidate generation: ${relativePath}`;
}
