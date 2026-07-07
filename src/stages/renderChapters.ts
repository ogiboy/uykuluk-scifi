import { table } from "../utils/markdown.js";
import type { DraftRenderManifest } from "./renderEvidenceContracts.js";

type ChapterSource = {
  runId: string;
  output: { path: string; sha256: string };
  timeline: DraftRenderManifest["timeline"];
};

export type DraftRenderChapter = {
  startSeconds: number;
  timestamp: string;
  title: string;
  segment: "intro" | "scene" | "outro";
  sceneIndex?: number;
  assetPath: string;
};

export type DraftRenderChapterDraft = {
  schemaVersion: 1;
  runId: string;
  source: { draftRenderPath: string; draftRenderSha256: string };
  chapters: DraftRenderChapter[];
  copyBlock: string;
  operatorNotes: string[];
  blockedActions: string[];
};

/**
 * Builds a local YouTube chapter draft from the render timeline.
 *
 * @param manifest - The draft render manifest used as the source of truth.
 * @returns A copy-ready local chapter draft plus operator safety notes.
 */
export function buildDraftRenderChapterDraft(manifest: ChapterSource): DraftRenderChapterDraft {
  const chapters = timelineChapters(manifest);
  return {
    schemaVersion: 1,
    runId: manifest.runId,
    source: { draftRenderPath: manifest.output.path, draftRenderSha256: manifest.output.sha256 },
    chapters,
    copyBlock: chapters.map((chapter) => `${chapter.timestamp} ${chapter.title}`).join("\n"),
    operatorNotes: [
      "Use these chapters as a local upload-prep draft, not as upload or publish approval.",
      "Review chapter titles against the final MP4, script, and channel tone before copying them anywhere.",
      "For very short timing drafts, revise chapter spacing manually before a future upload workflow.",
    ],
    blockedActions: [
      "Chapter drafts do not call YouTube APIs.",
      "Chapter drafts do not approve private upload.",
      "Chapter drafts do not approve scheduled or public publishing.",
    ],
  };
}

/**
 * Renders the local YouTube chapter draft as operator Markdown.
 *
 * @param draft - The chapter draft to render.
 * @returns Markdown containing a copy-ready chapter block and review notes.
 */
export function renderDraftRenderChaptersMarkdown(draft: DraftRenderChapterDraft): string {
  return [
    "# YouTube Chapter Draft",
    "",
    `Run: ${draft.runId}`,
    `Draft render: ${draft.source.draftRenderPath}`,
    `Draft render SHA-256: ${draft.source.draftRenderSha256}`,
    "",
    "> Local upload-prep artifact only. This does not upload, schedule, publish, or grant upload/publish approval.",
    "",
    "## Copy Block",
    "",
    "```text",
    draft.copyBlock,
    "```",
    "",
    "## Chapter Map",
    "",
    table(
      ["Timestamp", "Title", "Segment", "Scene", "Asset"],
      draft.chapters.map((chapter) => [
        chapter.timestamp,
        chapter.title,
        chapter.segment,
        chapter.sceneIndex ? String(chapter.sceneIndex) : "-",
        chapter.assetPath,
      ]),
    ),
    "",
    "## Operator Notes",
    "",
    draft.operatorNotes.map((note) => `- ${note}`).join("\n"),
    "",
    "## Still Blocked",
    "",
    draft.blockedActions.map((action) => `- ${action}`).join("\n"),
  ].join("\n");
}

function timelineChapters(manifest: ChapterSource): DraftRenderChapter[] {
  let cursorSeconds = 0;
  return manifest.timeline.map((item) => {
    const startSeconds = roundSeconds(cursorSeconds);
    cursorSeconds += item.durationSeconds;
    return {
      startSeconds,
      timestamp: formatChapterTimestamp(startSeconds),
      title: chapterTitle(item.segment ?? "scene", item.sceneIndex),
      segment: item.segment ?? "scene",
      ...(item.sceneIndex ? { sceneIndex: item.sceneIndex } : {}),
      assetPath: item.backgroundAsset.path,
    };
  });
}

function chapterTitle(
  segment: "intro" | "scene" | "outro",
  sceneIndex: number | undefined,
): string {
  if (segment === "intro") {
    return "Giriş";
  }
  if (segment === "outro") {
    return "Kapanış";
  }
  return `Sahne ${sceneIndex ?? "?"}`;
}

function formatChapterTimestamp(seconds: number): string {
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = String(rounded - minutes * 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
