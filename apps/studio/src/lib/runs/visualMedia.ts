import { createHash } from "node:crypto";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../../../../src/core/artifactRevision";
import { readProjectAssetBytesAtProjectRoot } from "../../../../../src/core/projectAssets";
import { loadVisualManifest } from "../../../../../src/stages/visuals/visualManifest";
import { readCoreVisualRunRecord } from "./visualRunRecord";

export type StudioVisualMediaResult =
  | Readonly<{ body: ArrayBuffer; headers: Headers; status: 200 | 206 }>
  | Readonly<{ status: 404 }>
  | Readonly<{ status: 416 }>;

/** Reads one active, digest-verified visual revision for browser display. */
export async function readStudioVisualMedia(
  root: string,
  runId: string,
  sceneIndex: number,
  expectedManifestDigest: string,
  expectedRevision: number,
  rangeHeader: string | null,
): Promise<StudioVisualMediaResult> {
  const run = await readCoreVisualRunRecord(root, runId);
  if (
    !run ||
    !/^[a-f0-9]{64}$/.test(expectedManifestDigest) ||
    !Number.isSafeInteger(sceneIndex) ||
    sceneIndex <= 0 ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision <= 0
  ) {
    return { status: 404 };
  }
  try {
    const loaded = await loadVisualManifest(run, root);
    if (loaded.digest !== expectedManifestDigest) return { status: 404 };
    const scene = loaded.manifest.scenes.find((item) => item.sceneIndex === sceneIndex);
    const active = scene?.revisions.find((item) => item.revision === scene.activeRevision);
    if (active?.revision !== expectedRevision) return { status: 404 };
    const body = active.asset.path.startsWith("assets/")
      ? await readProjectAssetBytesAtProjectRoot(root, active.asset.path)
      : await readRegisteredArtifactBytesAtProjectRoot(root, run, active.asset.path);
    if (!body) return { status: 404 };
    if (createHash("sha256").update(body).digest("hex") !== active.asset.digest) {
      return { status: 404 };
    }
    const range = parseByteRange(rangeHeader, body.byteLength);
    if (range.kind === "invalid") return { status: 416 };
    const responseBody =
      range.kind === "partial" ? body.subarray(range.start, range.end + 1) : body;
    return {
      body: Uint8Array.from(responseBody).buffer,
      headers: visualMediaHeaders(
        active.asset.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        body.byteLength,
        range,
      ),
      status: range.kind === "partial" ? 206 : 200,
    };
  } catch {
    return { status: 404 };
  }
}

type ByteRange =
  | Readonly<{ kind: "full" }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ end: number; kind: "partial"; start: number }>;

function parseByteRange(rangeHeader: string | null, sizeBytes: number): ByteRange {
  if (!rangeHeader) return { kind: "full" };
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || sizeBytes <= 0 || (!match[1] && !match[2])) return { kind: "invalid" };
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return { kind: "invalid" };
    return { end: sizeBytes - 1, kind: "partial", start: Math.max(sizeBytes - suffixLength, 0) };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : sizeBytes - 1;
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

function visualMediaHeaders(
  contentType: "image/jpeg" | "image/png",
  sizeBytes: number,
  range: ByteRange,
): Headers {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  if (range.kind === "partial") {
    headers.set("Content-Length", String(range.end - range.start + 1));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${sizeBytes}`);
  } else {
    headers.set("Content-Length", String(sizeBytes));
  }
  return headers;
}
