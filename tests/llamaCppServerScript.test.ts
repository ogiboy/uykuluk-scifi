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
  it("builds a bounded launch plan for an explicit repo-relative model path", async () => {
    const root = await createSecureTempDir();
    await createModelFile(path.join(root, baseConfig.model));

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

  it("resolves a bare model alias from models/llm with a .gguf fallback", async () => {
    const root = await createSecureTempDir();
    const model = "gemma-3-4b-it.Q4_K_M";
    const expectedModelPath = path.join(root, "models", "llm", `${model}.gguf`);
    await createModelFile(expectedModelPath);

    const plan = await createLlamaCppLaunchPlan(root, { ...baseConfig, model });

    expect(plan.modelPath).toBe(expectedModelPath);
  });

  it("resolves a bare .gguf filename from models/llm without adding an extension", async () => {
    const root = await createSecureTempDir();
    const model = "candidate.gguf";
    const expectedModelPath = path.join(root, "models", "llm", model);
    await createModelFile(expectedModelPath);

    const plan = await createLlamaCppLaunchPlan(root, { ...baseConfig, model });

    expect(plan.modelPath).toBe(expectedModelPath);
  });

  it("preserves the legacy bare path when the model is stored at the project root", async () => {
    const root = await createSecureTempDir();
    const model = "legacy-root-model.gguf";
    const expectedModelPath = path.join(root, model);
    await createModelFile(expectedModelPath);

    const plan = await createLlamaCppLaunchPlan(root, { ...baseConfig, model });

    expect(plan.modelPath).toBe(expectedModelPath);
  });

  it("preserves an absolute model path", async () => {
    const root = await createSecureTempDir();
    const model = path.join(root, "external-model.gguf");
    await createModelFile(model);

    const plan = await createLlamaCppLaunchPlan(root, { ...baseConfig, model });

    expect(plan.modelPath).toBe(model);
  });

  it("preserves config.model exactly as the llama.cpp alias", async () => {
    const root = await createSecureTempDir();
    const model = "gemma-3-4b-it.Q4_K_M";
    await createModelFile(path.join(root, "models", "llm", `${model}.gguf`));

    const plan = await createLlamaCppLaunchPlan(root, { ...baseConfig, model });

    expect(plan.args[plan.args.indexOf("--alias") + 1]).toBe(model);
  });

  it("reports attempted paths when a bare model file is missing", async () => {
    const root = await createSecureTempDir();
    const model = "missing-model";
    const legacyRootPath = path.join(root, model);
    const exactPath = path.join(root, "models", "llm", model);
    const extensionPath = `${exactPath}.gguf`;

    await expect(createLlamaCppLaunchPlan(root, { ...baseConfig, model })).rejects.toThrow(
      [
        "Configured llama.cpp model file is missing. Tried:",
        `- ${legacyRootPath}`,
        `- ${exactPath}`,
        `- ${extensionPath}`,
      ].join("\n"),
    );
  });

  it("does not append .gguf to an explicit missing relative path", async () => {
    const root = await createSecureTempDir();
    const model = "models/llm/missing-model";
    const expectedPath = path.join(root, model);

    await expect(createLlamaCppLaunchPlan(root, { ...baseConfig, model })).rejects.toThrow(
      `Configured llama.cpp model file is missing. Tried:\n- ${expectedPath}`,
    );
  });

  it("blocks invalid context overrides", async () => {
    const root = await createSecureTempDir();
    await createModelFile(path.join(root, baseConfig.model));

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

async function createModelFile(target: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "fixture");
}
