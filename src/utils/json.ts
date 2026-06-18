import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs";

export async function readJsonFile<T>(target: string): Promise<T> {
  return JSON.parse(await readFile(target, "utf8")) as T;
}

export async function writeJsonFile(target: string, value: unknown): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const dir = path.dirname(target);
  const temporaryPath = path.join(
    dir,
    `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await ensureDir(dir);
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, target);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}
