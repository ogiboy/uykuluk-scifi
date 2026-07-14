import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  writeTemporaryBinaryInputFile,
  writeTemporaryInputFile,
  type StudioTemporaryFileOperations,
} from "../apps/studio/src/lib/mutations/studioCliMutationTempFile";

describe("Studio CLI temporary inputs", () => {
  it.each([
    [
      "text",
      () =>
        writeTemporaryInputFile("payload", "studio-temp-text-", "input.txt", failingOperations()),
    ],
    [
      "binary",
      () =>
        writeTemporaryBinaryInputFile(
          new Uint8Array([1, 2, 3]),
          "studio-temp-binary-",
          "input.bin",
          failingOperations(),
        ),
    ],
  ] as const)("removes the created %s directory when writeFile fails", async (_kind, run) => {
    const invocation = run();
    const operations = lastOperations!;
    await expect(invocation).rejects.toThrow("injected write failure");
    expect(operations.directory).toBeTruthy();
    await expect(access(operations.directory!)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves both write and cleanup errors when removing the temporary directory fails", async () => {
    const writeError = new Error("injected write failure");
    const cleanupError = new Error("injected cleanup failure");
    const operations = failingOperations({ cleanupError, writeError });

    const invocation = writeTemporaryInputFile(
      "payload",
      "studio-temp-dual-failure-",
      "input.txt",
      operations,
    );

    const error = await invocation.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([writeError, cleanupError]);
    await rm(operations.directory!, { force: true, recursive: true });
  });
});

let lastOperations: (StudioTemporaryFileOperations & { directory?: string }) | null = null;

function failingOperations(errors?: {
  cleanupError?: Error;
  writeError?: Error;
}): StudioTemporaryFileOperations & { directory?: string } {
  const operations: StudioTemporaryFileOperations & { directory?: string } = {
    mkdtemp: (async (prefix: string) => {
      operations.directory = await mkdtemp(prefix);
      return operations.directory;
    }) as typeof mkdtemp,
    rm: errors?.cleanupError
      ? ((async () => {
          throw errors.cleanupError;
        }) as typeof rm)
      : rm,
    writeFile: (async () => {
      throw errors?.writeError ?? new Error("injected write failure");
    }) as typeof writeFile,
  };
  lastOperations = operations;
  return operations;
}
