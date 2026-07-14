import { loadVisualManifest } from "../../../../../src/stages/visuals/visualManifest";
import { getStudioActionServiceStatus } from "../actionServiceStatus";
import { readCoreVisualRunRecord } from "./visualRunRecord";

export { readStudioVisualMedia, type StudioVisualMediaResult } from "./visualMedia";

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
  const run = await readCoreVisualRunRecord(root, runId);
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
