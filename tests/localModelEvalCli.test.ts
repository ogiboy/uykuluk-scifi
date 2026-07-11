import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

  it("prints useful mixed candidate comparisons without failing the process", async () => {
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

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      baseOverrides: ["mode"],
      candidates: [
        expect.objectContaining({ configuredModel: "mock-deterministic", passed: true }),
        expect.objectContaining({ configuredModel: "mock-invalid-script-json", passed: false }),
      ],
      passed: false,
      providerMode: "mock",
      operatorGuidance: expect.objectContaining({
        decision: "candidate-ready-with-blockers",
        nextCommand: "pnpm producer eval local-model --llm-mode mock --model mock-deterministic",
      }),
      recommendedCandidate: expect.objectContaining({
        configuredModel: "mock-deterministic",
        passedChecks: 3,
      }),
    });
    await expect(readFile("producer.config.json", "utf8")).resolves.toBe(beforeConfig);
  });

  it("fails candidate comparison only when no candidate passes", async () => {
    const result = runCli([
      "eval",
      "local-model-candidates",
      "--llm-mode",
      "mock",
      "--candidate",
      "mock-invalid-script-json",
      "--json",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Local model candidate eval needs more candidates.");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      passed: false,
      operatorGuidance: expect.objectContaining({ decision: "try-more-candidates" }),
      recommendedCandidate: null,
    });
  });

  it("can discover ignored local GGUF candidates without mutating project config", async () => {
    const beforeConfig = await readFile("producer.config.json", "utf8");
    await mkdir("models/llm", { recursive: true });
    await writeFile("models/llm/zeta.Q4_K_M.gguf", "gguf fixture", "utf8");
    await writeFile("models/llm/alpha.Q4_K_M.gguf", "gguf fixture", "utf8");
    await writeFile("models/llm/not-a-model.txt", "ignored", "utf8");

    const result = runCli([
      "eval",
      "local-model-candidates",
      "--llm-mode",
      "mock",
      "--include-local-gguf",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      candidates: [
        expect.objectContaining({ configuredModel: "models/llm/alpha.Q4_K_M.gguf" }),
        expect.objectContaining({ configuredModel: "models/llm/zeta.Q4_K_M.gguf" }),
      ],
      providerMode: "mock",
    });
    await expect(readFile("producer.config.json", "utf8")).resolves.toBe(beforeConfig);
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const nodeOptions = (process.env.NODE_OPTIONS ?? "")
    .split(/\s+/)
    .map((option) => option.trim())
    .filter(Boolean)
    .filter((option) => !option.toLowerCase().startsWith("--inspect"));

  const result = spawnSync(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "src", "cli.ts"), ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions.length > 0 ? nodeOptions.join(" ") : undefined,
      },
    },
  );
  const rawStderr = result.stderr.toString();
  const sanitizedStderr = rawStderr
    .split(/\r?\n/)
    .filter((line) => !isNodeInspectorNoise(line))
    .join("\n")
    .trim();
  return { status: result.status, stderr: sanitizedStderr, stdout: result.stdout.toString() };
}

function isNodeInspectorNoise(line: string): boolean {
  const normalized = line
    .replaceAll(String.fromCharCode(27), "")
    .replace(/\[[0-9;]*[a-zA-Z]/g, "")
    .trim()
    .toLowerCase();
  return (
    normalized === "debugger attached." ||
    normalized === "waiting for the debugger to disconnect..." ||
    normalized.startsWith("debugger listening on ws://") ||
    normalized === "for help, see: https://nodejs.org/learn/getting-started/debugging"
  );
}
