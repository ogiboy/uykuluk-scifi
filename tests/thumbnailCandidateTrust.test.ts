import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ThumbnailCandidatePack } from "../src/stages/thumbnailCandidateContracts";
import { thumbnailAssetStaleReason } from "../src/stages/thumbnailCandidateTrust";
import { sha256 } from "../src/utils/hash";
import { useTempProject } from "./helpers";

describe("thumbnail candidate asset trust", () => {
  useTempProject();

  it("passes when every referenced thumbnail asset still matches", async () => {
    const pack = await trustedPack();

    await expect(thumbnailAssetStaleReason(pack)).resolves.toBeNull();
  });

  it("marks packs stale when a referenced thumbnail asset is missing", async () => {
    const pack = await trustedPack({
      templatePath: "assets/thumbnails/missing_template.jpg",
    });

    await expect(thumbnailAssetStaleReason(pack)).resolves.toBe(
      "Thumbnail asset is missing: assets/thumbnails/missing_template.jpg",
    );
  });

  it("marks packs stale when a referenced overlay asset changes", async () => {
    const pack = await trustedPack();
    await writeFile(
      path.join(process.cwd(), "assets/thumbnails/thumbnail_text_safe_overlay_01_left.png"),
      "changed overlay",
      "utf8",
    );

    await expect(thumbnailAssetStaleReason(pack)).resolves.toBe(
      "Thumbnail asset changed since handoff candidate generation: assets/thumbnails/thumbnail_text_safe_overlay_01_left.png",
    );
  });

  it("rethrows unexpected asset read failures", async () => {
    const directoryAsset = "assets/thumbnails/not_a_file.jpg";
    const pack = await trustedPack({ templatePath: directoryAsset });
    await mkdir(path.join(process.cwd(), directoryAsset), { recursive: true });

    await expect(thumbnailAssetStaleReason(pack)).rejects.toThrow();
  });
});

async function trustedPack(input: { templatePath?: string } = {}): Promise<ThumbnailCandidatePack> {
  const templatePath =
    input.templatePath ?? "assets/thumbnails/thumbnail_template_01_left_1280x720.jpg";
  const overlayPath = "assets/thumbnails/thumbnail_text_safe_overlay_01_left.png";
  await mkdir(path.join(process.cwd(), "assets/thumbnails"), { recursive: true });
  await writeFile(path.join(process.cwd(), overlayPath), "overlay", "utf8");
  if (!input.templatePath) {
    await writeFile(path.join(process.cwd(), templatePath), "template", "utf8");
  }
  return {
    blockedActions: ["No upload approval."],
    candidates: [
      {
        id: "thumbnail-01-left",
        reviewFocus: "Check title-safe area.",
        template: {
          digest: input.templatePath ? "a".repeat(64) : sha256("template"),
          path: templatePath,
          role: "thumbnail-template",
        },
        textSafeOverlay: {
          digest: sha256("overlay"),
          path: overlayPath,
          role: "thumbnail-overlay",
        },
      },
    ],
    operatorNotes: ["Pick manually."],
    recommendedCandidateId: "thumbnail-01-left",
    runId: "run_thumbnail_trust",
    schemaVersion: 1,
    source: {
      finalReviewBundleDigest: "b".repeat(64),
      finalReviewBundlePath: "production/review_bundle.json",
    },
  };
}
