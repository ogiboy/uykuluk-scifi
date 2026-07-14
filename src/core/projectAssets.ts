import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { isValidArtifactRelativePath } from "./artifactPathRules.js";
import { SafeExitError } from "./errors.js";

/** Reads one canonical `assets/` file while rejecting linked path components. */
export async function readProjectAssetBytesAtProjectRoot(
  projectRoot: string,
  relativePath: string,
): Promise<Buffer | undefined> {
  assertCanonicalProjectAssetPath(relativePath);
  const components = projectAssetComponents(projectRoot, relativePath);
  if (!(await projectAssetComponentsExistSafely(components))) return undefined;
  return readSafeProjectAssetFile(components.at(-1)!);
}

function assertCanonicalProjectAssetPath(relativePath: string): void {
  if (isValidArtifactRelativePath(relativePath) && relativePath.startsWith("assets/")) return;
  throw new SafeExitError("Project asset path must be a canonical relative path under assets/.");
}

function projectAssetComponents(projectRoot: string, relativePath: string): string[] {
  const components = [path.resolve(projectRoot)];
  for (const segment of relativePath.split("/")) {
    components.push(path.join(components.at(-1)!, segment));
  }
  return components;
}

async function projectAssetComponentsExistSafely(components: readonly string[]): Promise<boolean> {
  for (let index = 0; index < components.length; index += 1) {
    try {
      const info = await lstat(components[index]!);
      assertSafeProjectAssetComponent(info, index === components.length - 1);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
}

function assertSafeProjectAssetComponent(
  info: Awaited<ReturnType<typeof lstat>>,
  isFinal: boolean,
): void {
  if (info.isSymbolicLink()) {
    throw new SafeExitError("Project asset path must not contain symbolic links.");
  }
  if (!isFinal && !info.isDirectory()) {
    throw new SafeExitError("Project asset path contains a non-directory component.");
  }
  if (isFinal && (!info.isFile() || info.nlink !== 1)) {
    throw new SafeExitError("Project asset path must reference a safe regular file.");
  }
}

async function readSafeProjectAssetFile(target: string): Promise<Buffer | undefined> {
  let handle;
  try {
    handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1) {
      throw new SafeExitError("Project asset path must reference a safe regular file.");
    }
    return await handle.readFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    if (code === "ELOOP") {
      throw new SafeExitError("Project asset path must not contain symbolic links.");
    }
    throw error;
  } finally {
    await handle?.close();
  }
}
