import { readFile, stat } from "node:fs/promises";
import { studioRunFilePath } from "./runFilePaths";

const revisionContentLimitBytes = 200_000;

export const studioScriptRevisionStates = [
  "SCRIPT_GENERATED",
  "SCRIPT_REVIEWED",
  "SCRIPT_APPROVED",
] as const;
export const studioPackageArtifactRevisionStates = ["PRODUCTION_PACKAGE_GENERATED"] as const;
const studioRevisionStates = [
  ...studioScriptRevisionStates,
  ...studioPackageArtifactRevisionStates,
] as const;

export const studioPackageRevisionTargets = [
  {
    artifactKey: "subtitles",
    label: "Subtitles",
    path: "production/subtitles.srt",
  },
  {
    artifactKey: "scenes",
    label: "Scenes",
    path: "production/scenes.json",
  },
  {
    artifactKey: "popup-cards",
    label: "Popup cards",
    path: "production/production_package.md",
  },
  {
    artifactKey: "youtube-metadata",
    label: "YouTube metadata",
    path: "production/youtube_metadata.json",
  },
] as const;

export type StudioPackageRevisionTarget = (typeof studioPackageRevisionTargets)[number];

export type StudioRevisionSource = Readonly<{
  available: boolean;
  content: string;
  label: string;
  message: string;
  path: string;
}>;

export type StudioPackageRevisionSource = StudioRevisionSource &
  Readonly<{
    artifactKey: StudioPackageRevisionTarget["artifactKey"];
  }>;

export type StudioRevisionSources = Readonly<{
  packageArtifacts: readonly StudioPackageRevisionSource[];
  script: StudioRevisionSource;
}>;

/**
 * Checks whether Studio should expose script revision controls for a run state.
 *
 * @param state - The persisted core run state.
 * @returns True when CLI/core allows bounded script revision from this state.
 */
export function isStudioScriptRevisionState(state: string): boolean {
  return (studioScriptRevisionStates as readonly string[]).includes(state);
}

/**
 * Checks whether Studio should expose package artifact revision controls for a run state.
 *
 * @param state - The persisted core run state.
 * @returns True when CLI/core allows bounded package artifact revision from this state.
 */
export function isStudioPackageArtifactRevisionState(state: string): boolean {
  return (studioPackageArtifactRevisionStates as readonly string[]).includes(state);
}

/**
 * Checks whether Studio should show any local revision controls for a run state.
 *
 * @param state - The persisted core run state.
 * @returns True when at least one bounded revision action is currently eligible.
 */
export function isStudioRevisionState(state: string): boolean {
  return (studioRevisionStates as readonly string[]).includes(state);
}

/**
 * Reads bounded revision source content for Studio operator forms.
 *
 * @param root - The project root containing local runs.
 * @param runId - The run identifier to inspect.
 * @returns Current script and package artifact content when safe to expose in Studio.
 */
export async function readStudioRevisionSources(
  root: string,
  runId: string,
): Promise<StudioRevisionSources> {
  const packageArtifacts = await Promise.all(
    studioPackageRevisionTargets.map(async (target) => ({
      ...(await readRevisionSource(root, runId, target.path, target.label)),
      artifactKey: target.artifactKey,
    })),
  );
  return {
    packageArtifacts,
    script: await readRevisionSource(root, runId, "script.md", "Script"),
  };
}

async function readRevisionSource(
  root: string,
  runId: string,
  relativePath: string,
  label: string,
): Promise<StudioRevisionSource> {
  const target = studioRunFilePath(root, runId, relativePath);
  if (!target) {
    return unavailableSource(label, relativePath, "Artifact path is not safe to read.");
  }
  try {
    const fileStat = await stat(target);
    if (!fileStat.isFile()) {
      return unavailableSource(label, relativePath, "Artifact path is not a regular file.");
    }
    if (fileStat.size > revisionContentLimitBytes) {
      return unavailableSource(label, relativePath, "Artifact is too large for Studio editing.");
    }
    return {
      available: true,
      content: await readFile(target, "utf8"),
      label,
      message: "Current artifact content loaded from the local run directory.",
      path: relativePath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return unavailableSource(label, relativePath, "Artifact has not been generated yet.");
    }
    return unavailableSource(label, relativePath, (error as Error).message);
  }
}

function unavailableSource(label: string, path: string, message: string): StudioRevisionSource {
  return {
    available: false,
    content: "",
    label,
    message,
    path,
  };
}
