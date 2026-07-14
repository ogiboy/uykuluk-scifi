import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../../../../src/core/artifactRevision";
import { runRecordSchema, type RunRecord } from "../../../../../src/core/state";
import { loadVisualManifest } from "../../../../../src/stages/visuals/visualManifest";
import { getStudioActionServiceStatus } from "../actionServiceStatus";
import { studioRunFilePath } from "./runFilePaths";

export type StudioVisualActionId =
  "visuals.decide" | "visuals.import" | "visuals.prepare" | "visuals.regenerate";
export type StudioVisualActionBinding = Readonly<{
  actionId: StudioVisualActionId;
  routePath: string;
}>;
export type StudioVisualSceneSummary = Readonly<{
  activeRevision: number;
  assetPath: string;
  decision: "approved" | "pending" | "rejected";
  decisionNotes?: string;
  media: Readonly<{ height?: number; width?: number }>;
  mediaUrl: string;
  motion: string;
  productionSceneIndexes: readonly number[];
  prompt: string;
  provider: "manual-import" | "static";
  reviewedBy?: string;
  revisionCount: number;
  sceneIndex: number;
}>;
export type StudioVisualSummary = Readonly<{
  activeRevisions: readonly Readonly<{ activeRevision: number; sceneIndex: number }>[];
  actions: Readonly<Record<StudioVisualActionId, StudioVisualActionBinding | null>>;
  approvedCount: number;
  kind: "invalid" | "missing" | "ready";
  manifestDigest?: string;
  message: string;
  rejectedCount: number;
  scenes: readonly StudioVisualSceneSummary[];
  updatedAt?: string;
}>;

/** Projects the current validated visual manifest into the Studio review surface. */
export async function readStudioVisualSummary(
  root: string,
  runId: string,
): Promise<StudioVisualSummary> {
  const actions = visualActionBindings();
  const run = await readCoreRunRecord(root, runId);
  if (!run) {
    return visualSummary("invalid", "Run state could not be validated.", noVisualActions());
  }
  const mutationActions =
    run.state === "PRODUCTION_PACKAGE_GENERATED" ? actions : noVisualActions();
  if (!run.artifacts.includes("production/visuals/manifest.json")) {
    return visualSummary(
      "missing",
      run.state === "PRODUCTION_PACKAGE_GENERATED"
        ? "Prepare the deterministic 12-24 beat visual fallback to start contact-sheet review."
        : "Visual mutations are available only while the production package is the current workflow state.",
      {
        ...mutationActions,
        "visuals.decide": null,
        "visuals.import": null,
        "visuals.regenerate": null,
      },
    );
  }
  try {
    const loaded = await loadVisualManifest(run, root);
    const scenes = loaded.manifest.scenes.map((scene): StudioVisualSceneSummary => {
      const active = scene.revisions.find((revision) => revision.revision === scene.activeRevision);
      if (!active) throw new Error(`Visual scene ${scene.sceneIndex} has no active revision.`);
      return {
        activeRevision: active.revision,
        assetPath: active.asset.path,
        decision: scene.decision?.status ?? "pending",
        decisionNotes: scene.decision?.notes,
        media: { height: active.media?.height, width: active.media?.width },
        mediaUrl: visualMediaUrl(runId, scene.sceneIndex, loaded.digest, active.revision),
        motion: active.motion.kind,
        productionSceneIndexes: scene.productionSceneIndexes,
        prompt: scene.visualPrompt,
        provider: active.provider,
        reviewedBy: scene.decision?.reviewedBy,
        revisionCount: scene.revisions.length,
        sceneIndex: scene.sceneIndex,
      };
    });
    const approvedCount = scenes.filter((scene) => scene.decision === "approved").length;
    const rejectedCount = scenes.filter((scene) => scene.decision === "rejected").length;
    const activeRevisions = scenes.map((scene) => ({
      activeRevision: scene.activeRevision,
      sceneIndex: scene.sceneIndex,
    }));
    return {
      actions: { ...mutationActions, "visuals.prepare": null },
      activeRevisions,
      approvedCount,
      kind: "ready",
      manifestDigest: loaded.digest,
      message: `${approvedCount}/${scenes.length} visual beats approved; ${rejectedCount} rejected.`,
      rejectedCount,
      scenes,
      updatedAt: loaded.manifest.updatedAt,
    };
  } catch (error) {
    return visualSummary(
      "invalid",
      error instanceof Error ? error.message : String(error),
      noVisualActions(),
    );
  }
}

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
  const run = await readCoreRunRecord(root, runId);
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
    if (!active || active.revision !== expectedRevision) return { status: 404 };
    const body = active.asset.path.startsWith("production/")
      ? await readRegisteredArtifactBytesAtProjectRoot(root, run, active.asset.path)
      : await readContainedProjectAsset(root, active.asset.path);
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

async function readCoreRunRecord(root: string, runId: string): Promise<RunRecord | null> {
  const statePath = studioRunFilePath(root, runId, "state.json");
  if (!statePath) return null;
  try {
    return runRecordSchema.parse(JSON.parse(await readFile(statePath, "utf8")) as unknown);
  } catch {
    return null;
  }
}

function visualActionBindings(): Record<StudioVisualActionId, StudioVisualActionBinding | null> {
  const summaries = getStudioActionServiceStatus().summaries;
  const binding = (actionId: StudioVisualActionId): StudioVisualActionBinding | null => {
    const match = summaries.find(
      (summary) => summary.actionId === actionId && summary.routePath !== "unrouted",
    );
    return match ? { actionId, routePath: match.routePath } : null;
  };
  return {
    "visuals.decide": binding("visuals.decide"),
    "visuals.import": binding("visuals.import"),
    "visuals.prepare": binding("visuals.prepare"),
    "visuals.regenerate": binding("visuals.regenerate"),
  };
}

function noVisualActions(): Record<StudioVisualActionId, null> {
  return {
    "visuals.decide": null,
    "visuals.import": null,
    "visuals.prepare": null,
    "visuals.regenerate": null,
  };
}

function visualSummary(
  kind: "invalid" | "missing",
  message: string,
  actions: StudioVisualSummary["actions"],
): StudioVisualSummary {
  return {
    actions,
    activeRevisions: [],
    approvedCount: 0,
    kind,
    message,
    rejectedCount: 0,
    scenes: [],
  };
}

function visualMediaUrl(
  runId: string,
  sceneIndex: number,
  manifestDigest: string,
  revision: number,
): string {
  const params = new URLSearchParams({ manifestDigest, revision: String(revision) });
  return `/runs/${encodeURIComponent(runId)}/visuals/${sceneIndex}?${params.toString()}`;
}

async function readContainedProjectAsset(
  root: string,
  relativePath: string,
): Promise<Buffer | null> {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relativePath);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) return null;
  return readFile(target);
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
