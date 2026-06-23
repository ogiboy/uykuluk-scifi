import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createRun, loadRun, saveRun, statePath } from "../src/core/runStore";
import { RunRecord } from "../src/core/state";
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
    await expect(loadRun(run.runId)).resolves.toMatchObject({
      runId: run.runId,
      state: "NEW",
    });
  });

  it("rejects state whose embedded run id does not match its directory", async () => {
    const run = await createRun();
    await writeFile(
      statePath(run.runId),
      `${JSON.stringify(
        {
          ...run,
          runId: "run_20260619053334_foreign",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(loadRun(run.runId)).rejects.toThrow(/run id.*match|different run/i);
  });
});
