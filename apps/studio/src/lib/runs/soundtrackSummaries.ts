import { createHash } from "node:crypto";
import { readRegisteredArtifactBytesAtProjectRoot } from "../../../../../src/core/artifactRevision";
import {
  soundtrackManifestPath,
  validateSoundtrackManifestForRun,
  type SoundtrackManifest,
} from "../../../../../src/stages/soundtrack/soundtrackManifest";
import { getStudioActionServiceStatus } from "../actionServiceStatus";

export type StudioSoundtrackActionId =
  | "soundtrack.analyze"
  | "soundtrack.configure"
  | "soundtrack.decide"
  | "soundtrack.import"
  | "soundtrack.prepare";

export type StudioSoundtrackActionBinding = Readonly<{
  actionId: StudioSoundtrackActionId;
  routePath: string;
}>;

export type StudioSoundtrackSummary = Readonly<{
  actions: Readonly<Record<StudioSoundtrackActionId, StudioSoundtrackActionBinding | null>>;
  advanced: Readonly<{ paths: readonly string[] }>;
  analysis: Readonly<{ measuredAt: string; status: "complete" }> | null;
  assets: readonly StudioSoundtrackAssetSummary[];
  decision: Readonly<{
    decidedAt: string;
    notes: string;
    reviewedBy: string;
    status: "approved" | "rejected";
  }> | null;
  digest?: string;
  kind: "invalid" | "missing" | "ready";
  message: string;
  mix: Readonly<{
    music: Readonly<{
      assetId: string;
      fadeInSeconds: number;
      fadeOutSeconds: number;
      gainDb: number;
      trimStartSeconds: number;
    }> | null;
    sfx: readonly Readonly<{
      assetId: string;
      cueId: string;
      durationSeconds: number;
      fadeInSeconds: number;
      fadeOutSeconds: number;
      gainDb: number;
      startSeconds: number;
      trimStartSeconds: number;
    }>[];
    sfxCueCount: number;
  }>;
  mode: "mixed" | "voice-only" | null;
  nextAction: string;
  revision: number | null;
}>;

export type StudioSoundtrackAssetSummary = Readonly<{
  assetId: string;
  digest: string;
  durationSeconds: number;
  originalFileName: string;
  path: string;
  rights: Readonly<{ attestedBy: string; basis: string; evidence: string }>;
  role: "music" | "sfx";
}>;

type SoundtrackRun = Readonly<{ artifacts: string[]; runId: string; state: string }>;

/**
 * Projects registered soundtrack evidence into a Studio-safe review model.
 *
 * The read path intentionally accepts only the registered manifest artifact. It never exposes a
 * source import path, and invalid or mismatched evidence is rendered as a visible blocked state.
 */
export async function readStudioSoundtrackSummary(
  root: string,
  run: SoundtrackRun,
): Promise<StudioSoundtrackSummary> {
  const actions = soundtrackActions(run.state);
  if (!run.artifacts.includes(soundtrackManifestPath)) {
    return missingSummary(actions);
  }
  try {
    const bytes = await readRegisteredArtifactBytesAtProjectRoot(root, run, soundtrackManifestPath);
    if (!bytes) return invalidSummary("Registered soundtrack manifest is unavailable.");
    const manifest = validateSoundtrackManifestForRun(
      JSON.parse(bytes.toString("utf8")),
      run.runId,
    );
    return soundtrackSummaryFromManifest(
      manifest,
      createHash("sha256").update(bytes).digest("hex"),
      actions,
    );
  } catch (error) {
    return invalidSummary(
      error instanceof Error ? error.message : "Soundtrack evidence could not be validated.",
    );
  }
}

/** Creates a stable Studio projection from an already-validated soundtrack manifest. */
export function soundtrackSummaryFromManifest(
  manifest: SoundtrackManifest,
  digest: string,
  actions: StudioSoundtrackSummary["actions"] = noSoundtrackActions(),
): StudioSoundtrackSummary {
  const decision = manifest.decision
    ? {
        decidedAt: manifest.decision.decidedAt,
        notes: manifest.decision.notes,
        reviewedBy: manifest.decision.reviewedBy,
        status: manifest.decision.status,
      }
    : null;
  const analysis = manifest.analysis
    ? { measuredAt: manifest.analysis.measuredAt, status: "complete" as const }
    : null;
  const nextAction = soundtrackNextAction(manifest);
  return {
    actions,
    advanced: {
      paths: [
        soundtrackManifestPath,
        "production/audio/soundtrack/review.md",
        ...manifest.assets.map((asset) => asset.path),
      ],
    },
    analysis,
    assets: manifest.assets.map((asset) => ({
      assetId: asset.assetId,
      digest: asset.digest,
      durationSeconds: asset.media.durationSeconds,
      originalFileName: asset.provenance.originalFileName,
      path: asset.path,
      rights: {
        attestedBy: asset.provenance.rights.attestedBy,
        basis: asset.provenance.rights.basis,
        evidence: asset.provenance.rights.evidence,
      },
      role: asset.role,
    })),
    decision,
    digest,
    kind: "ready",
    message: soundtrackMessage(manifest),
    mix: {
      music: manifest.music
        ? {
            assetId: manifest.music.assetId,
            fadeInSeconds: manifest.music.fadeInSeconds,
            fadeOutSeconds: manifest.music.fadeOutSeconds,
            gainDb: manifest.music.gainDb,
            trimStartSeconds: manifest.music.trimStartSeconds,
          }
        : null,
      sfx: manifest.sfx.map((cue) => ({
        assetId: cue.assetId,
        cueId: cue.cueId,
        durationSeconds: cue.durationSeconds,
        fadeInSeconds: cue.fadeInSeconds,
        fadeOutSeconds: cue.fadeOutSeconds,
        gainDb: cue.gainDb,
        startSeconds: cue.startSeconds,
        trimStartSeconds: cue.trimStartSeconds,
      })),
      sfxCueCount: manifest.sfx.length,
    },
    mode: manifest.mode,
    nextAction,
    revision: manifest.revision,
  };
}

function soundtrackActions(
  state: string,
): Record<StudioSoundtrackActionId, StudioSoundtrackActionBinding | null> {
  const available = actionBindings();
  if (state !== "READY_FOR_MANUAL_PRODUCTION") return noSoundtrackActions();
  return available;
}

function actionBindings(): Record<StudioSoundtrackActionId, StudioSoundtrackActionBinding | null> {
  const summaries = getStudioActionServiceStatus().summaries as readonly Readonly<{
    actionId: string;
    routePath: string;
  }>[];
  const bind = (actionId: StudioSoundtrackActionId): StudioSoundtrackActionBinding | null => {
    const summary = summaries.find(
      (candidate) => candidate.actionId === actionId && candidate.routePath !== "unrouted",
    );
    return summary ? { actionId, routePath: summary.routePath } : null;
  };
  return {
    "soundtrack.analyze": bind("soundtrack.analyze"),
    "soundtrack.decide": bind("soundtrack.decide"),
    "soundtrack.import": bind("soundtrack.import"),
    "soundtrack.configure": bind("soundtrack.configure"),
    "soundtrack.prepare": bind("soundtrack.prepare"),
  };
}

function noSoundtrackActions(): Record<StudioSoundtrackActionId, null> {
  return {
    "soundtrack.analyze": null,
    "soundtrack.decide": null,
    "soundtrack.import": null,
    "soundtrack.configure": null,
    "soundtrack.prepare": null,
  };
}

function missingSummary(actions: StudioSoundtrackSummary["actions"]): StudioSoundtrackSummary {
  return {
    actions,
    advanced: { paths: [soundtrackManifestPath] },
    analysis: null,
    assets: [],
    decision: null,
    kind: "missing",
    message: "No soundtrack manifest has been recorded for this run.",
    mix: { music: null, sfx: [], sfxCueCount: 0 },
    mode: null,
    nextAction: "Prepare the voice-only fallback from the reviewed voice evidence.",
    revision: null,
  };
}

function invalidSummary(message: string): StudioSoundtrackSummary {
  return {
    actions: noSoundtrackActions(),
    advanced: { paths: [soundtrackManifestPath] },
    analysis: null,
    assets: [],
    decision: null,
    kind: "invalid",
    message,
    mix: { music: null, sfx: [], sfxCueCount: 0 },
    mode: null,
    nextAction: "Resolve the persisted soundtrack evidence before making a decision.",
    revision: null,
  };
}

function soundtrackMessage(manifest: SoundtrackManifest): string {
  const analysis = manifest.analysis
    ? "first-pass analysis recorded"
    : "first-pass analysis pending";
  const decision = manifest.decision ? `decision ${manifest.decision.status}` : "decision pending";
  return `Revision ${manifest.revision}: ${manifest.mode}, ${manifest.assets.length} imported asset(s), ${analysis}, ${decision}.`;
}

function soundtrackNextAction(manifest: SoundtrackManifest): string {
  if (!manifest.analysis) return "Run pass-1 loudness analysis for this exact revision.";
  if (!manifest.decision)
    return "Record an attributable approve or reject decision for this exact revision.";
  if (manifest.decision.status === "rejected")
    return "Revise the mix, rerun analysis, and record a new decision.";
  return "Soundtrack approval is current for this exact revision.";
}
