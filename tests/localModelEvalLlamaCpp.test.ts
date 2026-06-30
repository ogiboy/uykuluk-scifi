import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  localModelEvalJsonPath,
  localModelEvalMarkdownPath,
  runLocalModelEval,
} from "../src/diagnostics/localModelEval";
import { generateMockIdeasText } from "../src/providers/mockIdeasText";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";
import { jsonResponse, writeLlmConfig } from "./localModelEvalTestHelpers";

describe("local model evaluation with llama.cpp", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses stage-specific token caps and persists scrubbed reports", async () => {
    await writeLlmConfig({
      mode: "llama.cpp",
      llamaCppBaseUrl: "http://localhost:8080",
      model: "local-model.gguf",
      maxOutputTokens: {
        ideas: 777,
        script: 1234,
        productionPackage: 2000,
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: generateMockIdeasText() } }],
          model: "local-model.gguf",
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  text: "Anlatıcı: Buzun altından gelen sinyal ölçüm hatası olabilir, ama düzenli aralıklar ekibi yeni bir test kurmaya zorlar.",
                }),
              },
            },
          ],
          model: "local-model.gguf",
          usage: { prompt_tokens: 11, completion_tokens: 21 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const report = await runLocalModelEval();

    expect(report).toMatchObject({
      configuredModel: "local-model.gguf",
      passed: true,
      providerMode: "llama.cpp",
    });
    const requestBodies = fetchMock.mock.calls.map(
      (call) => JSON.parse(call[1]?.body as string) as { max_tokens?: number },
    );
    expect(requestBodies.map((body) => body.max_tokens)).toEqual([777, 1234]);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "script-quality-guard", status: "pass" }),
      ]),
    );
    expect(await readJsonFile(localModelEvalJsonPath())).toEqual(report);
    expect(await readFile(localModelEvalJsonPath(), "utf8")).not.toContain(
      "Anlatıcı: Buzun altından",
    );
    expect(await readFile(localModelEvalMarkdownPath(), "utf8")).not.toContain(
      "Anlatıcı: Buzun altından",
    );
  });

  it("redacts endpoint details from blocked eval artifacts", async () => {
    await writeLlmConfig({
      mode: "llama.cpp",
      llamaCppBaseUrl: "http://user:local-secret@localhost:8080/private?token=local-secret",
      model: "local-model.gguf",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED local-secret")));

    const report = await runLocalModelEval();

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "llama.cpp provider request failed.",
          status: "block",
        }),
      ]),
    );
    for (const value of [
      JSON.stringify(report),
      await readFile(localModelEvalJsonPath(), "utf8"),
      await readFile(localModelEvalMarkdownPath(), "utf8"),
    ]) {
      expect(value).not.toContain("local-secret");
      expect(value).not.toContain("user:");
      expect(value).not.toContain("/private");
    }
  });
});
