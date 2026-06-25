import path from "node:path";

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
