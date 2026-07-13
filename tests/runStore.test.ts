import { mkdir, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { withRunStateLock } from "../src/core/runStateLock";
import { createRun, loadRun, runPath, saveRun, statePath } from "../src/core/runStore";
import { RunRecord } from "../src/core/state";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";

describe("run store integrity", () => {
  useTempProject();

  it("fails closed when state JSON is malformed", async () => {
    const run = await createRun();
    await writeFile(statePath(run.runId), '{"state":', "utf8");

    await expect(loadRun(run.runId)).rejects.toMatchObject({
      name: "SafeExitError",
      message: expect.stringContaining("Run state is invalid"),
    });
  });

  it("fails closed when persisted state violates the schema", async () => {
    const run = await createRun();
    await writeFile(
      statePath(run.runId),
      `${JSON.stringify({ ...run, state: "PUBLIC_WITHOUT_APPROVAL" }, null, 2)}\n`,
      "utf8",
    );

    await expect(loadRun(run.runId)).rejects.toMatchObject({
      name: "SafeExitError",
      message: expect.stringContaining("Run state is invalid"),
    });
  });

  it("rejects invalid state before replacing the last valid record", async () => {
    const run = await createRun();

    await expect(
      saveRun({ ...run, state: "PUBLIC_WITHOUT_APPROVAL" } as unknown as RunRecord),
    ).rejects.toThrow();
    await expect(loadRun(run.runId)).resolves.toMatchObject({ runId: run.runId, state: "NEW" });
  });

  it("rejects a stale concurrent save instead of overwriting the newer run record", async () => {
    const created = await createRun();
    const first = await loadRun(created.runId);
    const stale = await loadRun(created.runId);
    await saveRun({ ...first, warnings: ["first-writer"] });

    await expect(saveRun({ ...stale, warnings: ["stale-writer"] })).rejects.toThrow(
      "Run state changed",
    );
    await expect(loadRun(created.runId)).resolves.toMatchObject({ warnings: ["first-writer"] });
  });

  it("rejects state whose embedded run id does not match its directory", async () => {
    const run = await createRun();
    await writeFile(
      statePath(run.runId),
      `${JSON.stringify({ ...run, runId: "run_20260619053334_foreign" }, null, 2)}\n`,
      "utf8",
    );

    await expect(loadRun(run.runId)).rejects.toThrow(/run id.*match|different run/i);
  });

  it("does not rethrow a malformed lock owner while retaining the unverified lock", async () => {
    const run = await createRun();
    const lockPath = runPath(run.runId, ".state-mutation.lock");

    await expect(
      withRunStateLock(run.runId, async () => {
        await writeFile(runPath(run.runId, ".state-mutation.lock", "owner.json"), "{", "utf8");
      }),
    ).resolves.toBeUndefined();
    await expect(pathExists(lockPath)).resolves.toBe(true);
  });

  it("propagates unrelated filesystem errors while reading a lock owner", async () => {
    const run = await createRun();
    const ownerPath = runPath(run.runId, ".state-mutation.lock", "owner.json");

    await expect(
      withRunStateLock(run.runId, async () => {
        await rm(ownerPath);
        await mkdir(ownerPath);
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/EISDIR|EACCES|EPERM/) });
  });
});
