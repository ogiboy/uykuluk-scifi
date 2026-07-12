import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type StudioTemporaryInputFile = Readonly<{ cleanup: () => Promise<void>; filePath: string }>;

/**
 * Writes a short-lived local input file for guarded Studio CLI mutations.
 *
 * @param content - The validated request content to write.
 * @param directoryPrefix - The temporary directory prefix.
 * @param fileName - The file name to create inside the temporary directory.
 * @returns The created path and a cleanup callback.
 */
export async function writeTemporaryInputFile(
  content: string,
  directoryPrefix: string,
  fileName: string,
): Promise<StudioTemporaryInputFile> {
  const directory = await mkdtemp(path.join(tmpdir(), directoryPrefix));
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
  return { cleanup: () => rm(directory, { force: true, recursive: true }), filePath };
}
