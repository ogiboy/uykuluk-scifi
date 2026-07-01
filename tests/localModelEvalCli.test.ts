import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { useTempProject } from "./helpers";

const repoRoot = process.cwd();

describe("producer local-model eval CLI", () => {
  useTempProject();

  it("applies one-run provider overrides and keeps JSON output parseable when blocked", async () => {
    const beforeConfig = await readFile("producer.config.json", "utf8");

    const result = runCli([
      "eval",
      "local-model",
      "--llm-mode",
      "mock",
      "--model",
      "mock-invalid-script-json",
      "--json",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Local model eval blocked.");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      appliedOverrides: ["mode", "model"],
      configSource: "cli-overrides",
      configuredModel: "mock-invalid-script-json",
      providerMode: "mock",
      passed: false,
    });
    await expect(readFile("producer.config.json", "utf8")).resolves.toBe(beforeConfig);
  });

  it("prints candidate comparison JSON without mutating project config", async () => {
    const beforeConfig = await readFile("producer.config.json", "utf8");

    const result = runCli([
      "eval",
      "local-model-candidates",
      "--llm-mode",
      "mock",
      "--candidate",
      "mock-deterministic",
      "--candidate",
      "mock-invalid-script-json",
      "--json",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Local model candidate eval blocked.");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      baseOverrides: ["mode"],
      candidates: [
        expect.objectContaining({ configuredModel: "mock-deterministic", passed: true }),
        expect.objectContaining({ configuredModel: "mock-invalid-script-json", passed: false }),
      ],
      passed: false,
      providerMode: "mock",
      operatorGuidance: expect.objectContaining({
        nextCommand: "pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
      }),
      recommendedCandidate: expect.objectContaining({
        configuredModel: "mock-deterministic",
        passedChecks: 3,
      }),
    });
    await expect(readFile("producer.config.json", "utf8")).resolves.toBe(beforeConfig);
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
