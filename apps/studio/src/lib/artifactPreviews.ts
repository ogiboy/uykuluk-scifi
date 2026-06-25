import { open, stat } from "node:fs/promises";
import path from "node:path";

const PREVIEW_BYTE_LIMIT = 2_400;

export type StudioArtifactGroup =
  | "Audio And Render"
  | "Evidence And Readiness"
  | "Production Package"
  | "Render Planning"
  | "Script Review";

export type StudioArtifactKind = "binary" | "json" | "markdown" | "text";

type ReviewArtifactDefinition = {
  description: string;
  group: StudioArtifactGroup;
  kind: StudioArtifactKind;
  label: string;
  operatorAction: string;
  path: string;
};

const REVIEW_ARTIFACTS = parseArtifactTable(String.raw`
script.md	Script draft	markdown	Script Review	Operator-readable episode script generated from the approved idea.	Review script warnings and approve by digest from the CLI.
reviews/script_review.md	Script review	markdown	Script Review	Safety, quality, and approval guidance for the current script digest.	Resolve blockers or acknowledge non-blocking warnings before approval.
production/production_package.md	Production package	markdown	Production Package	Voiceover, scenes, subtitles, popup cards, and YouTube metadata package.	Inspect package completeness before render planning.
production/render_plan.json	Render plan	json	Render Planning	Deterministic intro/outro and scene-to-asset mapping for the local draft render.	Review bookend timing, scene timing, and asset choices before voice/render work.
production/storyboard_contact_sheet.md	Storyboard contact sheet	markdown	Render Planning	Operator contact sheet summarizing visual rhythm and selected assets.	Use this as review evidence; it is not render approval.
production/asset_provenance.json	Asset provenance	json	Render Planning	Exact committed asset paths and roles used by the render plan.	Confirm assets are tracked, licensed, and visually appropriate.
production/audio/voiceover.meta.json	Voiceover metadata	json	Audio And Render	Local TTS metadata, source digest, duration, and render-plan binding.	Confirm voiceover source and duration before render approval.
production/audio/voiceover_review.md	Voiceover review	markdown	Audio And Render	Operator-readable local TTS review checklist generated with the WAV.	Listen locally and confirm pacing/pronunciation before render approval.
production/render/render_manifest.json	Render manifest	json	Audio And Render	Local FFmpeg draft-render manifest with input digests, intro-to-outro timeline, overlays, and review checklist.	Use with the MP4 for local final review; upload remains disabled.
production/render/draft_review.md	Draft render review	markdown	Audio And Render	Operator-readable final draft review checklist generated with the local MP4.	Review this before any future private upload approval; upload remains disabled.
production/render/draft.mp4	Draft render video	binary	Audio And Render	Local MP4 review draft generated after exact render approval.	Review locally outside Studio; binary preview is metadata-only.
evidence_bundle.json	Evidence bundle	json	Evidence And Readiness	Current run evidence, blocked actions, and next safe command.	Use evidence as the review handoff before any next CLI action.
diagnostics/readiness.json	Readiness diagnostics	json	Evidence And Readiness	Readiness checks for package, cost, render plan, TTS, and publish safety.	Resolve failed checks before production or render work.
`);

export type StudioArtifactPreview = {
  description: string;
  exists: boolean;
  group: StudioArtifactGroup;
  kind: StudioArtifactKind;
  label: string;
  operatorAction: string;
  path: string;
  preview: string | null;
  previewTruncated: boolean;
  sizeBytes: number | null;
};

function parseArtifactTable(input: string): ReviewArtifactDefinition[] {
  return input
    .trim()
    .split("\n")
    .map((row) => parseArtifactRow(row));
}

function parseArtifactRow(row: string): ReviewArtifactDefinition {
  const [pathName, label, kind, group, description, operatorAction] = row.split("\t");
  if (
    !pathName ||
    !label ||
    !isStudioArtifactKind(kind) ||
    !isStudioArtifactGroup(group) ||
    !description ||
    !operatorAction
  ) {
    throw new Error(`Invalid Studio artifact preview definition: ${row}`);
  }
  return { description, group, kind, label, operatorAction, path: pathName };
}

function isStudioArtifactKind(value: string | undefined): value is StudioArtifactKind {
  return value === "binary" || value === "json" || value === "markdown" || value === "text";
}

function isStudioArtifactGroup(value: string | undefined): value is StudioArtifactGroup {
  return (
    value === "Audio And Render" ||
    value === "Evidence And Readiness" ||
    value === "Production Package" ||
    value === "Render Planning" ||
    value === "Script Review"
  );
}

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
