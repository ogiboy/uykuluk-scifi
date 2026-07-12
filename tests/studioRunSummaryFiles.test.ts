import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  readRunRecord,
  readStudioRunDiagnostics,
} from "../apps/studio/src/lib/runs/runSummaryFiles";
import { useTempProject } from "./helpers";

describe("Studio run file reads", () => {
  useTempProject();

  it("does not read run files through traversal-shaped run IDs", async () => {
    await mkdir("outside/diagnostics", { recursive: true });
    await writeFile(
      "outside/state.json",
      `${JSON.stringify({ runId: "../outside", state: "FAILED" })}\n`,
      "utf8",
    );
    await writeFile(
      "outside/diagnostics/script_generation_failure.json",
      `${JSON.stringify({
        runId: "../outside",
        stage: "script",
        state: "FAILED",
        providerMode: "mock",
        message: "Outside diagnostic must not be loaded.",
        createdAt: "2026-06-28T00:00:00.000Z",
      })}\n`,
      "utf8",
    );

    await expect(readRunRecord(process.cwd(), "../outside")).resolves.toBeNull();
    await expect(
      readStudioRunDiagnostics(process.cwd(), "../outside", [
        "diagnostics/script_generation_failure.json",
      ]),
    ).resolves.toEqual([]);
  });
});
