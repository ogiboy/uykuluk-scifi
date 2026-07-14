import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type StudioTemporaryInputFile = Readonly<{ cleanup: () => Promise<void>; filePath: string }>;
export type StudioTemporaryFileOperations = Readonly<{
  mkdtemp: typeof mkdtemp;
  rm: typeof rm;
  writeFile: typeof writeFile;
}>;

const defaultOperations: StudioTemporaryFileOperations = { mkdtemp, rm, writeFile };

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
  operations: StudioTemporaryFileOperations = defaultOperations,
): Promise<StudioTemporaryInputFile> {
  return writeTemporaryFile(
    content,
    directoryPrefix,
    fileName,
    { encoding: "utf8", mode: 0o600 },
    operations,
  );
}

/** Writes validated binary mutation input to a short-lived owner-only file. */
export async function writeTemporaryBinaryInputFile(
  content: Uint8Array,
  directoryPrefix: string,
  fileName: string,
  operations: StudioTemporaryFileOperations = defaultOperations,
): Promise<StudioTemporaryInputFile> {
  return writeTemporaryFile(content, directoryPrefix, fileName, { mode: 0o600 }, operations);
}

async function writeTemporaryFile(
  content: string | Uint8Array,
  directoryPrefix: string,
  fileName: string,
  options: Parameters<typeof writeFile>[2],
  operations: StudioTemporaryFileOperations,
): Promise<StudioTemporaryInputFile> {
  const directory = await operations.mkdtemp(path.join(tmpdir(), directoryPrefix));
  const filePath = path.join(directory, fileName);
  try {
    await operations.writeFile(filePath, content, options);
  } catch (error) {
    try {
      await operations.rm(directory, { force: true, recursive: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Temporary input write and cleanup both failed.",
      );
    }
    throw error;
  }
  return { cleanup: () => operations.rm(directory, { force: true, recursive: true }), filePath };
}
