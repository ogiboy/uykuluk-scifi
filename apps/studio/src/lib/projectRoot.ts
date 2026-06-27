import path from "node:path";

/**
 * Resolves the project root directory.
 *
 * @returns The path from `UYKULUK_SCIFI_ROOT`, the repository root when running from `apps/studio`, or the current working directory.
 */
export function projectRoot(): string {
  if (process.env.UYKULUK_SCIFI_ROOT) {
    return process.env.UYKULUK_SCIFI_ROOT;
  }

  const cwd = process.cwd();
  if (cwd.endsWith(path.join("apps", "studio"))) {
    return path.resolve(cwd, "../..");
  }

  return cwd;
}
