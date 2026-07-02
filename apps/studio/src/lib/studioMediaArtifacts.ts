import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { studioRunFilePath } from "./runFilePaths";

const allowedStudioMediaArtifacts = {
  "production/audio/voiceover.wav": "audio/wav",
  "production/render/draft.mp4": "video/mp4",
} as const;

const studioCaptionArtifactPath = "production/subtitles.vtt";
const studioCaptionSourcePath = "production/subtitles.srt";

export type StudioMediaArtifactPath = keyof typeof allowedStudioMediaArtifacts;

type StudioMediaReadResult =
  | {
      body: BodyInit;
      headers: Headers;
      status: 200 | 206;
    }
  | { status: 404 | 416 };

/**
 * Builds the Studio-local media URL for an allowlisted run artifact.
 *
 * @param runId - The run identifier owning the media artifact.
 * @param artifactPath - The artifact-relative media path.
 * @returns A URL path suitable for an audio/video `src`, or `null` when the artifact is not media.
 */
export function studioMediaArtifactUrl(runId: string, artifactPath: string): string | null {
  return isStudioMediaArtifactPath(artifactPath)
    ? `/runs/${encodeURIComponent(runId)}/media/${artifactPath}`
    : null;
}

/**
 * Builds the Studio-local WebVTT captions URL for local media previews.
 *
 * @param runId - The run identifier owning the subtitle artifact.
 * @returns A URL path for the generated WebVTT captions route.
 */
export function studioCaptionArtifactUrl(runId: string): string {
  return `/runs/${encodeURIComponent(runId)}/media/${studioCaptionArtifactPath}`;
}

/**
 * Reads an allowlisted Studio-local media artifact as a stream response payload.
 *
 * @param root - The project root directory.
 * @param runId - The run identifier owning the media artifact.
 * @param artifactPath - The artifact-relative media path.
 * @param rangeHeader - Optional HTTP Range header from the browser media element.
 * @returns A stream response payload or a fail-closed status.
 */
export async function readStudioMediaArtifact(
  root: string,
  runId: string,
  artifactPath: string,
  rangeHeader: string | null,
): Promise<StudioMediaReadResult> {
  if (artifactPath === studioCaptionArtifactPath) {
    return readStudioCaptionArtifact(root, runId);
  }
  if (!isStudioMediaArtifactPath(artifactPath)) {
    return { status: 404 };
  }
  const target = studioRunFilePath(root, runId, artifactPath);
  if (!target) {
    return { status: 404 };
  }
  try {
    const fileStat = await stat(target);
    if (!fileStat.isFile()) {
      return { status: 404 };
    }
    const range = parseByteRange(rangeHeader, fileStat.size);
    if (range.kind === "invalid") {
      return { status: 416 };
    }
    const headers = mediaHeaders(artifactPath, fileStat.size, range);
    const stream = createReadStream(target, range.kind === "partial" ? range : {});
    return {
      body: Readable.toWeb(stream) as BodyInit,
      headers,
      status: range.kind === "partial" ? 206 : 200,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: 404 };
    }
    throw error;
  }
}

async function readStudioCaptionArtifact(
  root: string,
  runId: string,
): Promise<StudioMediaReadResult> {
  const target = studioRunFilePath(root, runId, studioCaptionSourcePath);
  if (!target) {
    return { status: 404 };
  }
  try {
    return {
      body: srtToWebVtt(await readFile(target, "utf8")),
      headers: new Headers({
        "Cache-Control": "no-store",
        "Content-Type": "text/vtt; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      }),
      status: 200,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: 404 };
    }
    throw error;
  }
}

/**
 * Converts the persisted SRT subtitle artifact into browser-readable WebVTT.
 *
 * @param input - The subtitle content in SRT format.
 * @returns WebVTT content suitable for an HTML media track.
 */
export function srtToWebVtt(input: string): string {
  const normalizedInput = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  const body = normalizedInput
    .split("\n")
    .map((line) => (line.includes("-->") ? line.replaceAll(",", ".") : line))
    .join("\n");
  return `WEBVTT\n\n${body}\n`;
}

function isStudioMediaArtifactPath(value: string): value is StudioMediaArtifactPath {
  return value in allowedStudioMediaArtifacts;
}

type ByteRange =
  { kind: "full" } | { kind: "invalid" } | { end: number; kind: "partial"; start: number };

function parseByteRange(rangeHeader: string | null, sizeBytes: number): ByteRange {
  if (!rangeHeader) {
    return { kind: "full" };
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return { kind: "invalid" };
  }
  return byteRangeFromMatch(match[1] ?? "", match[2] ?? "", sizeBytes);
}

function byteRangeFromMatch(rawStart: string, rawEnd: string, sizeBytes: number): ByteRange {
  if (sizeBytes <= 0 || (!rawStart && !rawEnd)) {
    return { kind: "invalid" };
  }
  if (!rawStart) {
    return suffixByteRange(rawEnd, sizeBytes);
  }
  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : sizeBytes - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    end >= sizeBytes
  ) {
    return { kind: "invalid" };
  }
  return { end, kind: "partial", start };
}

function suffixByteRange(rawEnd: string, sizeBytes: number): ByteRange {
  const suffixLength = Number(rawEnd);
  if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
    return { kind: "invalid" };
  }
  const start = Math.max(sizeBytes - suffixLength, 0);
  return { end: sizeBytes - 1, kind: "partial", start };
}

function mediaHeaders(
  artifactPath: StudioMediaArtifactPath,
  sizeBytes: number,
  range: ByteRange,
): Headers {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": allowedStudioMediaArtifacts[artifactPath],
    "X-Content-Type-Options": "nosniff",
  });
  if (range.kind === "partial") {
    headers.set("Content-Length", String(range.end - range.start + 1));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${sizeBytes}`);
    return headers;
  }
  headers.set("Content-Length", String(sizeBytes));
  return headers;
}
