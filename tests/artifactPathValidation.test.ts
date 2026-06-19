import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { createRun, loadRun, statePath } from "../src/core/runStore";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";

describe("artifact path validation", () => {
  useTempProject();

  it.each([
    "",
    ".",
    "..",
    "../outside.md",
    "reviews/../outside.md",
    "/tmp/outside.md",
    "C:\\temp\\outside.md",
    "\\\\server\\share\\outside.md",
    "reviews\\script.md",
    "./script.md",
    "reviews//script.md",
    "reviews/",
    " script.md",
    "script.md ",
    "script\n.md",
    "üretim/script.md",
    "production/video:final.mp4",
    "CON",
    "con.txt",
    "production/NUL.json",
    "production/COM1.log",
    "script.",
    "reviews/script..",
    `${"a".repeat(510)}.md`,
  ])("rejects unsafe artifact path %j", (relativePath) => {
    expect(() => artifactPath("run_20260619053334_pkt3z1", relativePath)).toThrow(
      /invalid artifact path/i,
    );
  });

  it.each([
    "ideas.json",
    "script.md",
    "reviews/script_review.json",
    "production/production_package.meta.json",
    "diagnostics/readiness.md",
    "revisions/script/revision_20260619053334_pkt3z1/invalidated/script_review.md",
  ])("preserves existing artifact path %j", (relativePath) => {
    expect(artifactPath("run_20260619053334_pkt3z1", relativePath)).toBe(
      path.join(process.cwd(), "runs", "run_20260619053334_pkt3z1", ...relativePath.split("/")),
    );
  });

  it("blocks an outside write before filesystem or ledger mutation", async () => {
    const run = await createRun();
    const relativePath = `../${run.runId}-escape.md`;
    const outsidePath = path.resolve("..", `${run.runId}-escape.md`);

    try {
      await expect(writeRunText(run, "test", relativePath, "escape")).rejects.toThrow(
        /invalid artifact path/i,
      );
      expect(await pathExists(outsidePath)).toBe(false);
      expect(await readLedger(run.runId)).toHaveLength(1);
    } finally {
      await rm(outsidePath, { force: true });
    }
  });

  it("rejects persisted state containing an unsafe artifact path", async () => {
    const run = await createRun();
    await writeFile(
      statePath(run.runId),
      `${JSON.stringify({ ...run, artifacts: ["../outside.md"] }, null, 2)}\n`,
      "utf8",
    );

    await expect(loadRun(run.runId)).rejects.toThrow(/artifact path/i);
  });
});
