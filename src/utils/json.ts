import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs";

/**
 * Reads and parses a JSON file.
 *
 * @param target - Path to the JSON file
 * @returns The parsed JSON content as type `T`
 */
export async function readJsonFile<T>(target: string): Promise<T> {
  return JSON.parse(await readFile(target, "utf8")) as T;
}

/**
 * Atomically writes a value as JSON to a file.
 *
 * Creates the target directory if needed. The JSON is pretty-printed with a trailing newline.
 *
 * @param target - The file path where the JSON will be written
 * @param value - The value to serialize as JSON
 */
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
