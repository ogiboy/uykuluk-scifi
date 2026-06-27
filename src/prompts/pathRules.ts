const SAFE_PROMPT_OVERRIDE_PATH_PATTERN =
  /^prompts\/local\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*\.md$/;

/**
 * Checks whether a prompt override path is a bounded local Markdown path.
 *
 * @param configured - Configured path from `producer.config.json`
 * @returns `true` when the path points to `prompts/local/*.md`
 */
export function isValidPromptOverridePath(configured: string): boolean {
  return (
    configured.length <= 512 &&
    SAFE_PROMPT_OVERRIDE_PATH_PATTERN.test(configured) &&
    configured.split("/").every(isPortablePromptPathSegment)
  );
}

function isPortablePromptPathSegment(segment: string): boolean {
  const basename = segment.split(".", 1)[0];
  return !segment.endsWith(".") && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(basename);
}
