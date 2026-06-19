import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "./fs";

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
  await writeFileAtomic(target, content);
}
