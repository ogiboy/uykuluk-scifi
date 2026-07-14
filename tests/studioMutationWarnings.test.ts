import { describe, expect, it } from "vitest";
import { studioMutationWarnings } from "../apps/studio/src/lib/mutations/studioMutationWarnings";

describe("Studio mutation warning normalization", () => {
  it("removes ANSI, control, newline, and bidirectional formatting before applying limits", () => {
    expect(
      studioMutationWarnings([
        "\u001B[31m\u001B[0m",
        "\u001B[31mDanger\u001B[0m\nline\t\u202Espoof\u0000",
        "second\rwarning",
        "third\u2066warning",
        "fourth warning",
      ]),
    ).toEqual(["Danger line spoof", "second warning", "third warning"]);
  });
});
