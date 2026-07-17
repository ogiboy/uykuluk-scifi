import { loadVisualManifest } from "../../../../../src/stages/visuals/visualManifest";
import { getStudioActionServiceStatus } from "../actionServiceStatus";
import {
  emptyHostedVisualSummary,
  readStudioHostedVisualSummary,
  type StudioHostedVisualSummary,
} from "./hostedVisualSummaries";
import { readCoreVisualRunRecord } from "./visualRunRecord";

export type { StudioHostedVisualSummary } from "./hostedVisualSummaries";
export { readStudioVisualMedia, type StudioVisualMediaResult } from "./visualMedia";

export type StudioVisualActionId =
  | "visuals.decide"
  | "visuals.generate-hosted"
  | "visuals.import"
  | "visuals.plan-hosted"
  | "visuals.prepare"
  | "visuals.regenerate";
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
  provider: "black-forest-labs" | "manual-import" | "static";
  reviewedBy?: string;
  revisionCount: number;
  sceneIndex: number;
}>;
export type StudioVisualSummary = Readonly<{
  activeRevisions: readonly Readonly<{ activeRevision: number; sceneIndex: number }>[];
  actions: Readonly<Record<StudioVisualActionId, StudioVisualActionBinding | null>>;
  approvedCount: number;
  hosted: StudioHostedVisualSummary;
  kind: "invalid" | "missing" | "ready";
  manifestDigest?: string;
  message: string;
  rejectedCount: number;
  scenes: readonly StudioVisualSceneSummary[];
  updatedAt?: string;
}>;

/**
 * Projects a validated visual run and manifest into the Studio review surface.
 *
 * @param root - Repository root containing the run records and visual artifacts
 * @param runId - Identifier of the visual run to review
 * @returns The visual review summary, including scene data, hosted visual status, approval counts, and workflow-allowed actions
 */
export async function readStudioVisualSummary(
  root: string,
  runId: string,
): Promise<StudioVisualSummary> {
  const actions = visualActionBindings();
  const run = await readCoreVisualRunRecord(root, runId);
  if (!run) {
    return visualSummary("invalid", "Run state could not be validated.", noVisualActions());
  }
  if (!run.artifacts.includes("production/visuals/manifest.json")) {
    const mutationActions = visualMutationActions(run.state, actions, 0);
    return visualSummary(
      "missing",
      run.state === "PRODUCTION_PACKAGE_GENERATED"
        ? "Prepare the deterministic 12-24 beat visual fallback to start contact-sheet review."
        : "Visual mutations are available only while the production package is the current workflow state.",
      {
        ...mutationActions,
        "visuals.decide": null,
        "visuals.generate-hosted": null,
        "visuals.import": null,
        "visuals.plan-hosted": null,
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
    const mutationActions = visualMutationActions(run.state, actions, rejectedCount);
    const activeRevisions = scenes.map((scene) => ({
      activeRevision: scene.activeRevision,
      sceneIndex: scene.sceneIndex,
    }));
    const hosted = await readStudioHostedVisualSummary(root, run, rejectedCount);
    return {
      actions: {
        ...mutationActions,
        "visuals.generate-hosted": hosted.execution
          ? mutationActions["visuals.generate-hosted"]
          : null,
        "visuals.plan-hosted": hosted.allowedPlanPurpose
          ? mutationActions["visuals.plan-hosted"]
          : null,
        "visuals.prepare": null,
      },
      activeRevisions,
      approvedCount,
      hosted,
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

/**
 * Resolves available Studio visual actions to their routed service bindings.
 *
 * @returns A binding for each visual action with a routed service endpoint, or `null` when no routed endpoint is available.
 */
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
    "visuals.generate-hosted": binding("visuals.generate-hosted"),
    "visuals.import": binding("visuals.import"),
    "visuals.plan-hosted": binding("visuals.plan-hosted"),
    "visuals.prepare": binding("visuals.prepare"),
    "visuals.regenerate": binding("visuals.regenerate"),
  };
}

function noVisualActions(): Record<StudioVisualActionId, null> {
  return {
    "visuals.decide": null,
    "visuals.generate-hosted": null,
    "visuals.import": null,
    "visuals.plan-hosted": null,
    "visuals.prepare": null,
    "visuals.regenerate": null,
  };
}

/**
 * Determines which visual mutation actions are available for the current workflow state.
 *
 * @param state - The current visual production workflow state.
 * @param actions - Available action bindings keyed by visual action ID.
 * @param rejectedCount - Number of rejected visual scenes.
 * @returns Action bindings enabled for the state, with unavailable actions set to `null`.
 */
function visualMutationActions(
  state: string,
  actions: Record<StudioVisualActionId, StudioVisualActionBinding | null>,
  rejectedCount: number,
): Record<StudioVisualActionId, StudioVisualActionBinding | null> {
  if (state === "PRODUCTION_PACKAGE_GENERATED") {
    return { ...actions, "visuals.generate-hosted": null };
  }
  if (state === "READY_FOR_MANUAL_PRODUCTION") {
    return {
      ...noVisualActions(),
      "visuals.decide": actions["visuals.decide"],
      "visuals.generate-hosted": actions["visuals.generate-hosted"],
      "visuals.plan-hosted": rejectedCount > 0 ? actions["visuals.plan-hosted"] : null,
    };
  }
  if (state === "PAID_GENERATION_COST_APPROVED") {
    return {
      ...noVisualActions(),
      "visuals.decide": actions["visuals.decide"],
      "visuals.generate-hosted": actions["visuals.generate-hosted"],
      "visuals.plan-hosted": rejectedCount > 0 ? actions["visuals.plan-hosted"] : null,
    };
  }
  return noVisualActions();
}

/**
 * Creates an invalid or missing visual summary with empty scene, decision, and hosted-visual data.
 *
 * @param kind - Indicates whether the visual data is invalid or missing
 * @param message - Explains why the visual summary is unavailable
 * @param actions - Available operator actions for the current workflow state
 * @returns A visual summary containing the provided status, message, and actions with empty result data
 */
function visualSummary(
  kind: "invalid" | "missing",
  message: string,
  actions: StudioVisualSummary["actions"],
): StudioVisualSummary {
  return {
    actions,
    activeRevisions: [],
    approvedCount: 0,
    hosted: emptyHostedVisualSummary(),
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
