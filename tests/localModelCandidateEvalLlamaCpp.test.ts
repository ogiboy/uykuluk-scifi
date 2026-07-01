import { afterEach, describe, expect, it, vi } from "vitest";
import { runLocalModelCandidateEval } from "../src/diagnostics/localModelCandidateEval";
import { generateMockIdeasText } from "../src/providers/mockIdeasText";
import { useTempProject } from "./helpers";
import { jsonResponse, writeLlmConfig } from "./localModelEvalTestHelpers";

describe("local model candidate evaluation with llama.cpp", () => {
  useTempProject();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not mark a llama.cpp candidate as passing when the server returns another model", async () => {
    await writeLlmConfig({
      mode: "llama.cpp",
      llamaCppBaseUrl: "http://localhost:8080",
      model: "served-model.gguf",
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            data: [{ id: "served-model.gguf" }],
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            choices: [{ message: { content: generateMockIdeasText() } }],
            model: "served-model.gguf",
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    text: "Anlatıcı: Sinyal düzenli görünür ama ekip önce ölçüm hatası ihtimalini kapatır.",
                  }),
                },
              },
            ],
            model: "served-model.gguf",
          }),
        )
        .mockResolvedValue(
          jsonResponse({
            choices: [{ message: { content: generateMockIdeasText() } }],
            model: "served-model.gguf",
          }),
        ),
    );

    const report = await runLocalModelCandidateEval({
      candidates: ["served-model.gguf", "missing-model.gguf"],
      llmOverrides: { mode: "llama.cpp" },
    });

    expect(report.passed).toBe(false);
    expect(report.operatorGuidance).toMatchObject({
      decision: "candidate-ready-with-blockers",
      message: expect.stringContaining("blocked candidates"),
    });
    expect(report.candidates).toEqual([
      expect.objectContaining({
        configuredModel: "served-model.gguf",
        passed: true,
      }),
      expect.objectContaining({
        configuredModel: "missing-model.gguf",
        passed: false,
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: "ideas-json",
            message:
              "llama.cpp candidate model is not served by the current local server. Start llama-server with this GGUF, then rerun candidate eval.",
            status: "block",
          }),
        ]),
      }),
    ]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it("surfaces llama.cpp diagnostics failures separately from unserved candidates", async () => {
    await writeLlmConfig({
      mode: "llama.cpp",
      llamaCppBaseUrl: "http://localhost:8080/private",
      model: "served-model.gguf",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const report = await runLocalModelCandidateEval({
      candidates: ["candidate-model.gguf"],
      llmOverrides: { mode: "llama.cpp" },
    });

    expect(report).toMatchObject({
      passed: false,
      operatorGuidance: {
        decision: "try-more-candidates",
      },
      candidates: [
        expect.objectContaining({
          configuredModel: "candidate-model.gguf",
          passed: false,
          checks: expect.arrayContaining([
            expect.objectContaining({
              name: "ideas-json",
              message: expect.stringContaining("llama.cpp candidate preflight failed"),
              status: "block",
            }),
            expect.objectContaining({
              name: "script-quality-guard",
              message: "Skipped because llama.cpp served-model diagnostics failed.",
              status: "block",
            }),
          ]),
        }),
      ],
    });
    expect(report.candidates[0].checks[0].message).not.toContain(
      "candidate model is not served by the current local server",
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
