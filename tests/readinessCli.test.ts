import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runIdeas } from "../src/stages/ideas";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer readiness CLI", () => {
  useTempProject();

  it("prints parseable JSON diagnostics when readiness blocks", async () => {
    const { runId } = await runIdeas();
    const result = runCli(["readiness", "--run", runId, "--json"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Readiness blocked.");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      passed: false,
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: "script generated",
          status: "block",
        }),
      ]),
    });
    expect(result.stdout).toContain(`pnpm producer estimate --run ${runId}`);
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}
