import { describe, expect, it } from "vitest";

import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";

describe("Studio model-eval mutation service contracts", () => {
  it("parses candidate eval payloads without unknown fields", () => {
    expect(parseStudioMutationRequest("model-eval.run", {})).toEqual({});
    expect(() =>
      parseStudioMutationRequest("model-eval.run", { runId: "run_operator_review" }),
    ).toThrow(/Unrecognized key/);
    expect(
      parseStudioMutationRequest("model-eval-candidates.run", {
        candidates: ["gemma-3-4b-it-q4_0", "llama-3.2-3b-instruct-q4_k_m"],
        includeLocalGguf: false,
      }),
    ).toEqual({
      candidates: ["gemma-3-4b-it-q4_0", "llama-3.2-3b-instruct-q4_k_m"],
      includeLocalGguf: false,
    });
    expect(
      parseStudioMutationRequest("model-eval-candidates.run", { includeLocalGguf: true }),
    ).toEqual({ candidates: [], includeLocalGguf: true });
    expect(() => parseStudioMutationRequest("model-eval-candidates.run", {})).toThrow(
      /Candidate evaluation requires/,
    );
    expect(() =>
      parseStudioMutationRequest("model-eval-candidates.run", {
        candidates: [],
        includeLocalGguf: false,
      }),
    ).toThrow(/Candidate evaluation requires/);
    expect(() =>
      parseStudioMutationRequest("model-eval-candidates.run", {
        candidates: ["gemma-3-4b-it-q4_0"],
        extra: true,
      }),
    ).toThrow(/Unrecognized key/);
  });
});
