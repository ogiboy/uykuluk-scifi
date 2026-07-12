import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { SafeExitError } from "../core/errors.js";
import { table } from "../utils/markdown.js";
import {
  thumbnailCandidatePackSchema,
  type AssetRef,
  type ThumbnailCandidatePack,
} from "./thumbnail/thumbnailCandidateContracts.js";

export {
  thumbnailCandidatePackSchema,
  thumbnailCandidatesJsonPath,
  thumbnailCandidatesMarkdownPath,
} from "./thumbnail/thumbnailCandidateContracts.js";
export type { AssetRef, ThumbnailCandidatePack } from "./thumbnail/thumbnailCandidateContracts.js";

/**
 * Builds local thumbnail candidates from tracked thumbnail assets.
 *
 * @param input - Run and final-review binding data.
 * @returns A validated thumbnail candidate package.
 */
export async function buildThumbnailCandidatePack(input: {
  finalReviewBundleDigest: string;
  runId: string;
}): Promise<ThumbnailCandidatePack> {
  const templates = await listThumbnailAssets(/thumbnail_template/i, "thumbnail-template");
  const overlays = await listThumbnailAssets(/thumbnail_text_safe_overlay/i, "thumbnail-overlay");
  if (templates.length === 0) {
    throw new SafeExitError("Manual channel handoff requires tracked thumbnail templates.");
  }
  const candidates = templates.map((template, index) => ({
    id: thumbnailCandidateId(template.path, index),
    template,
    ...matchingOverlay(template, overlays),
    reviewFocus:
      "Check title-safe area, contrast, scientific caution, channel tone, and no misleading visual claim.",
  }));
  return thumbnailCandidatePackSchema.parse({
    schemaVersion: 1,
    runId: input.runId,
    source: {
      finalReviewBundlePath: "production/review_bundle.json",
      finalReviewBundleDigest: input.finalReviewBundleDigest,
    },
    recommendedCandidateId: candidates[0].id,
    candidates,
    operatorNotes: [
      "Pick or revise one thumbnail manually before any future upload path.",
      "These are tracked template candidates only; no image generation or YouTube upload occurs.",
      "Record the final thumbnail choice outside this MVP handoff until a future approval path exists.",
    ],
    blockedActions: [
      "Thumbnail candidates do not approve private upload.",
      "Thumbnail candidates do not approve scheduled or public publishing.",
      "Thumbnail candidates do not call image-generation or YouTube APIs.",
    ],
  });
}

/**
 * Renders thumbnail candidates as operator Markdown.
 *
 * @param pack - The thumbnail candidate package.
 * @returns Markdown for local manual thumbnail review.
 */
export function renderThumbnailCandidateMarkdown(pack: ThumbnailCandidatePack): string {
  return [
    "# Thumbnail Candidate Handoff",
    "",
    `Run: ${pack.runId}`,
    `Recommended candidate: ${pack.recommendedCandidateId}`,
    "",
    "> Local thumbnail review artifact only. This does not generate images, upload media, schedule, publish, or grant upload/publish approval.",
    "",
    "## Candidates",
    "",
    table(
      ["ID", "Template", "Template SHA-256", "Text-safe overlay", "Review focus"],
      pack.candidates.map((candidate) => [
        candidate.id,
        candidate.template.path,
        candidate.template.digest,
        candidate.textSafeOverlay?.path ?? "-",
        candidate.reviewFocus,
      ]),
    ),
    "",
    "## Operator Notes",
    "",
    pack.operatorNotes.map((note) => `- ${note}`).join("\n"),
    "",
    "## Still Blocked",
    "",
    pack.blockedActions.map((action) => `- ${action}`).join("\n"),
  ].join("\n");
}

async function listThumbnailAssets(pattern: RegExp, role: string): Promise<AssetRef[]> {
  const relativeDir = "assets/thumbnails";
  let entries;
  try {
    entries = await readdir(path.join(process.cwd(), relativeDir), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && pattern.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => thumbnailAssetRef(role, path.posix.join(relativeDir, entry.name))),
  );
}

async function thumbnailAssetRef(role: string, relativePath: string): Promise<AssetRef> {
  if (!relativePath.startsWith("assets/thumbnails/")) {
    throw new SafeExitError(`Thumbnail asset must live under assets/thumbnails/: ${relativePath}`);
  }
  const bytes = await readFile(path.join(process.cwd(), relativePath));
  return { role, path: relativePath, digest: createHash("sha256").update(bytes).digest("hex") };
}

function matchingOverlay(
  template: AssetRef,
  overlays: readonly AssetRef[],
): { textSafeOverlay?: AssetRef } {
  const templateKey = /_(\d{2})_([a-z]+)_/.exec(template.path);
  if (!templateKey) {
    return {};
  }
  const [, number, position] = templateKey;
  const overlay = overlays.find((item) => item.path.includes(`_${number}_${position}_`));
  return overlay ? { textSafeOverlay: overlay } : {};
}

function thumbnailCandidateId(templatePath: string, index: number): string {
  const parsed = /thumbnail_template_(\d{2})_([a-z]+)/.exec(path.basename(templatePath));
  return parsed ? `thumbnail-${parsed[1]}-${parsed[2]}` : `thumbnail-${index + 1}`;
}
