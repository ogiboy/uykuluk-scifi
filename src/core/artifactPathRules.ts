const ARTIFACT_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const MAX_ARTIFACT_PATH_LENGTH = 512;
const WINDOWS_RESERVED_BASENAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Determines if a path is valid as a relative artifact path.
 *
 * A valid artifact path must not exceed 512 characters, match the expected pattern of forward-slash-separated segments, and ensure each segment is portable across platforms.
 *
 * @returns `true` if the path is valid, `false` otherwise.
 */
export function isValidArtifactRelativePath(relativePath: string): boolean {
  return (
    relativePath.length <= MAX_ARTIFACT_PATH_LENGTH &&
    ARTIFACT_PATH_PATTERN.test(relativePath) &&
    relativePath.split("/").every(isPortableArtifactSegment)
  );
}

/**
 * Determines if a path segment can be safely used across platforms.
 *
 * A segment is portable if it does not end with a dot and does not use a
 * Windows-reserved device name as its basename.
 *
 * @param segment - The path segment to validate
 * @returns `true` if the segment is portable, `false` otherwise
 */
function isPortableArtifactSegment(segment: string): boolean {
  const basename = segment.split(".", 1)[0];
  return !segment.endsWith(".") && !WINDOWS_RESERVED_BASENAME.test(basename);
}
