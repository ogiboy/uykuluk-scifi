import { describe, expect, it } from "vitest";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";

describe("Studio revision mutation contracts", () => {
  it("parses bounded script and package-artifact revision payloads", () => {
    expect(
      parseStudioMutationRequest("script.revise", {
        content: "Revize edilmiş Türkçe senaryo.\n",
        editor: "operator",
        reason: "Açılışı daha net yap.",
        runId: "run_operator_review",
      }),
    ).toEqual({
      content: "Revize edilmiş Türkçe senaryo.\n",
      editor: "operator",
      reason: "Açılışı daha net yap.",
      runId: "run_operator_review",
    });

    expect(
      parseStudioMutationRequest("package-artifact.revise", {
        artifactKey: "subtitles",
        content: "1\n00:00:00,000 --> 00:00:02,000\nRevize altyazı.\n",
        editor: "operator",
        reason: "Zamanlamayı düzelt.",
        runId: "run_operator_review",
      }),
    ).toEqual({
      artifactKey: "subtitles",
      content: "1\n00:00:00,000 --> 00:00:02,000\nRevize altyazı.\n",
      editor: "operator",
      reason: "Zamanlamayı düzelt.",
      runId: "run_operator_review",
    });
  });

  it("rejects malformed revision run ids and artifact targets", () => {
    expect(() =>
      parseStudioMutationRequest("script.revise", {
        content: "Revize edilmiş Türkçe senaryo.\n",
        editor: "operator",
        reason: "Malformed run id should fail.",
        runId: "../run_escape",
      }),
    ).toThrow(/Invalid run id/);

    expect(() =>
      parseStudioMutationRequest("package-artifact.revise", {
        artifactKey: "unknown",
        content: "1\n00:00:00,000 --> 00:00:02,000\nRevize altyazı.\n",
        editor: "operator",
        reason: "Geçersiz hedef.",
        runId: "run_operator_review",
      }),
    ).toThrow();
  });
});
