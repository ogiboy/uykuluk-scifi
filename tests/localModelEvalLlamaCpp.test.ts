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
      llamaCppBaseUrl:
        "http://fixture-user:fixture-password@localhost:8080/private?sample=fixture-value",
      model: "local-model.gguf",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED fixture-password")));

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
      expect(value).not.toContain("fixture-password");
      expect(value).not.toContain("fixture-user");
      expect(value).not.toContain("/private");
    }
  });

  it("blocks eval reports when llama.cpp serves a different model than requested", async () => {
    await writeLlmConfig({
      mode: "llama.cpp",
      llamaCppBaseUrl: "http://localhost:8080",
      model: "requested-model.gguf",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse({
            choices: [{ message: { content: generateMockIdeasText() } }],
            model: "served-model.gguf",
          }),
        ),
      ),
    );

    const report = await runLocalModelEval();

    expect(report.passed).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ideas-json",
          status: "block",
          message: "llama.cpp provider served a different model than requested.",
        }),
        expect.objectContaining({
          name: "script-section-json",
          status: "block",
          message: "llama.cpp provider served a different model than requested.",
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("served-model.gguf");
    expect(await readFile(localModelEvalJsonPath(), "utf8")).not.toContain("served-model.gguf");
    expect(await readFile(localModelEvalMarkdownPath(), "utf8")).not.toContain("served-model.gguf");
  });
});
