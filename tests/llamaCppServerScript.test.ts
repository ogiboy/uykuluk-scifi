import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLlamaCppLaunchPlan } from "../scripts/model/llama-cpp-server.js";

const baseConfig = {
  mode: "llama.cpp" as const,
  ollamaBaseUrl: "http://localhost:11434",
  llamaCppBaseUrl: "http://127.0.0.1:8087",
  model: "models/llm/candidate.gguf",
  thinkingMode: "default" as const,
  requestTimeoutMs: 180_000,
  maxOutputTokens: { ideas: 3000, script: 3200, productionPackage: 2000 },
};

describe("llama.cpp model server script", () => {
  it("builds a bounded launch plan from the ignored project config contract", async () => {
    const root = await createSecureTempDir();
    await mkdir(path.join(root, "models", "llm"), { recursive: true });
    await writeFile(path.join(root, baseConfig.model), "fixture");

    const plan = await createLlamaCppLaunchPlan(root, baseConfig, {
      LLAMA_CPP_CTX_SIZE: "4096",
      LLAMA_CPP_SERVER_BINARY: "/opt/local/bin/llama-server",
    });

    expect(plan.binary).toBe("/opt/local/bin/llama-server");
    expect(plan.args).toEqual([
      "--model",
      path.join(root, baseConfig.model),
      "--alias",
      baseConfig.model,
      "--host",
      "127.0.0.1",
      "--port",
      "8087",
      "--ctx-size",
      "4096",
      "--parallel",
      "1",
    ]);
    expect(plan.pidPath).toBe(path.join(root, "diagnostics", "llama-server.pid"));
  });

  it("blocks missing model files and invalid context overrides", async () => {
    const root = await createSecureTempDir();
    await expect(createLlamaCppLaunchPlan(root, baseConfig)).rejects.toThrow(
      "Configured llama.cpp model file is missing",
    );

    await mkdir(path.join(root, "models", "llm"), { recursive: true });
    await writeFile(path.join(root, baseConfig.model), "fixture");
    await expect(
      createLlamaCppLaunchPlan(root, baseConfig, { LLAMA_CPP_CTX_SIZE: "unbounded" }),
    ).rejects.toThrow("LLAMA_CPP_CTX_SIZE must be a positive integer");
  });
});

async function createSecureTempDir(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykuluk-llama-server-plan-"));
  await chmod(root, 0o700);
  return root;
}
