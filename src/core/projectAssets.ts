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
  if (!isValidArtifactRelativePath(relativePath) || !relativePath.startsWith("assets/")) {
    throw new SafeExitError("Project asset path must be a canonical relative path under assets/.");
  }
  const root = path.resolve(projectRoot);
  const components = [root];
  for (const segment of relativePath.split("/")) {
    components.push(path.join(components.at(-1)!, segment));
  }
  for (let index = 0; index < components.length; index += 1) {
    try {
      const info = await lstat(components[index]!);
      if (info.isSymbolicLink()) {
        throw new SafeExitError("Project asset path must not contain symbolic links.");
      }
      if (index < components.length - 1 && !info.isDirectory()) {
        throw new SafeExitError("Project asset path contains a non-directory component.");
      }
      if (index === components.length - 1 && (!info.isFile() || info.nlink !== 1)) {
        throw new SafeExitError("Project asset path must reference a safe regular file.");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  let handle;
  try {
    handle = await open(components.at(-1)!, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
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
