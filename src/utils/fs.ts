import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function writeTextFile(target: string, content: string): Promise<void> {
  await ensureDir(path.dirname(target));
  await writeFile(target, content, "utf8");
}

export async function listFilesIfExists(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }
  return readdir(dir);
}
