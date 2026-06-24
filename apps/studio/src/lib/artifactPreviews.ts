import { open, stat } from "node:fs/promises";
import path from "node:path";

const PREVIEW_BYTE_LIMIT = 2_400;

export type StudioArtifactKind = "binary" | "json" | "markdown" | "text";

type ReviewArtifactDefinition = {
  kind: StudioArtifactKind;
  label: string;
  path: string;
};

const REVIEW_ARTIFACTS: readonly ReviewArtifactDefinition[] = [
  { path: "script.md", label: "Script draft", kind: "markdown" },
  { path: "reviews/script_review.md", label: "Script review", kind: "markdown" },
  { path: "production/production_package.md", label: "Production package", kind: "markdown" },
  { path: "production/render_plan.json", label: "Render plan", kind: "json" },
  {
    path: "production/storyboard_contact_sheet.md",
    label: "Storyboard contact sheet",
    kind: "markdown",
  },
  { path: "production/audio/voiceover.meta.json", label: "Voiceover metadata", kind: "json" },
  { path: "production/render/render_manifest.json", label: "Render manifest", kind: "json" },
  { path: "production/render/draft.mp4", label: "Draft render video", kind: "binary" },
  { path: "evidence_bundle.json", label: "Evidence bundle", kind: "json" },
  { path: "diagnostics/readiness.json", label: "Readiness diagnostics", kind: "json" },
] as const;

export type StudioArtifactPreview = {
  exists: boolean;
  kind: StudioArtifactKind;
  label: string;
  path: string;
  preview: string | null;
  previewTruncated: boolean;
  sizeBytes: number | null;
};

export async function readReviewArtifactPreviews(
  root: string,
  runId: string,
): Promise<StudioArtifactPreview[]> {
  return Promise.all(
    REVIEW_ARTIFACTS.map((artifact) => readArtifactPreview(root, runId, artifact)),
  );
}

async function readArtifactPreview(
  root: string,
  runId: string,
  artifact: ReviewArtifactDefinition,
): Promise<StudioArtifactPreview> {
  const file = path.join(root, "runs", runId, ...artifact.path.split("/"));
  try {
    const fileStat = await stat(file);
    if (!fileStat.isFile()) {
      return unavailableArtifact(artifact, fileStat.size, "artifact path is not a regular file");
    }
    if (artifact.kind === "binary") {
      return {
        ...artifact,
        exists: true,
        preview: null,
        previewTruncated: false,
        sizeBytes: fileStat.size,
      };
    }
    const preview = await readLimitedText(file, fileStat.size);
    return {
      ...artifact,
      exists: true,
      preview: formatArtifactPreview(artifact, preview.text, preview.truncated),
      previewTruncated: preview.truncated,
      sizeBytes: fileStat.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return missingArtifact(artifact);
    }
    return unavailableArtifact(artifact, null, (error as Error).message);
  }
}

function missingArtifact(artifact: ReviewArtifactDefinition): StudioArtifactPreview {
  return {
    ...artifact,
    exists: false,
    preview: null,
    previewTruncated: false,
    sizeBytes: null,
  };
}

function unavailableArtifact(
  artifact: ReviewArtifactDefinition,
  sizeBytes: number | null,
  reason: string,
): StudioArtifactPreview {
  return {
    ...artifact,
    exists: true,
    preview: `Preview unavailable: ${reason}.`,
    previewTruncated: false,
    sizeBytes,
  };
}

async function readLimitedText(
  file: string,
  sizeBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const byteLimit = Math.min(sizeBytes, PREVIEW_BYTE_LIMIT);
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(byteLimit);
    const { bytesRead } = await handle.read(buffer, 0, byteLimit, 0);
    return {
      text: buffer.subarray(0, bytesRead).toString("utf8").trim(),
      truncated: sizeBytes > bytesRead,
    };
  } finally {
    await handle.close();
  }
}

function formatArtifactPreview(
  artifact: ReviewArtifactDefinition,
  text: string,
  truncated: boolean,
): string {
  if (artifact.kind === "json" && !truncated) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text || "Preview unavailable: JSON artifact is empty or malformed.";
    }
  }
  return text || "Preview unavailable: artifact is empty.";
}
