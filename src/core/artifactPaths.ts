import path from "node:path";
import { SafeExitError } from "./errors";
import { runDir } from "./runPaths";

const ARTIFACT_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const MAX_ARTIFACT_PATH_LENGTH = 512;
const WINDOWS_RESERVED_BASENAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export function isValidArtifactRelativePath(relativePath: string): boolean {
  return (
    relativePath.length <= MAX_ARTIFACT_PATH_LENGTH &&
    ARTIFACT_PATH_PATTERN.test(relativePath) &&
    relativePath.split("/").every(isPortableArtifactSegment)
  );
}

export function validateArtifactRelativePath(relativePath: string): string {
  if (!isValidArtifactRelativePath(relativePath)) {
    throw new SafeExitError(
      "Invalid artifact path. Expected a 1-512 character relative path of safe forward-slash-separated segments.",
    );
  }
  return relativePath;
}

export function artifactPath(runId: string, relativePath: string): string {
  const validated = validateArtifactRelativePath(relativePath);
  return path.join(runDir(runId), ...validated.split("/"));
}

function isPortableArtifactSegment(segment: string): boolean {
  const basename = segment.split(".", 1)[0];
  return !segment.endsWith(".") && !WINDOWS_RESERVED_BASENAME.test(basename);
}
