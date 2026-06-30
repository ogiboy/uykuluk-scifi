import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readCliVersion } from "../src/cli/version";

const repoRoot = process.cwd();

describe("CLI version", () => {
  it("uses the package version for the root producer command", () => {
    const packageVersion = packageJsonVersion();
    const result = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      [path.join(repoRoot, "src", "cli.ts"), "--version"],
      { cwd: repoRoot, encoding: "utf8" },
    );

    expect(readCliVersion()).toBe(packageVersion);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
  });
});

function packageJsonVersion(): string {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    version?: unknown;
  };
  if (typeof packageJson.version !== "string") {
    throw new TypeError("package.json must contain a string version.");
  }
  return packageJson.version;
}
