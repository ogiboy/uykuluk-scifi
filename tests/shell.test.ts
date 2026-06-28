import { describe, expect, it } from "vitest";
import { shellCommand, shellQuote } from "../src/utils/shell";

describe("shell command formatting", () => {
  it("quotes unsafe shell arguments while leaving safe tokens readable", () => {
    expect(shellQuote("safe/path")).toBe("safe/path");
    expect(shellQuote("two words")).toBe("'two words'");
    expect(shellQuote("Bob's file")).toBe("'Bob'\"'\"'s file'");
    expect(shellCommand("ffmpeg tool", ["-i", "draft video.mp4"])).toBe(
      "'ffmpeg tool' -i 'draft video.mp4'",
    );
  });
});
