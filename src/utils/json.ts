import { readFile } from "node:fs/promises";
import { writeTextFile } from "./fs";

export async function readJsonFile<T>(target: string): Promise<T> {
  return JSON.parse(await readFile(target, "utf8")) as T;
}

export async function writeJsonFile(target: string, value: unknown): Promise<void> {
  await writeTextFile(target, `${JSON.stringify(value, null, 2)}\n`);
}
