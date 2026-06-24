import {
  defaultPiperModel,
  normalizeModelDir,
  piperConfigSnippet,
  piperModelFileUrl,
} from "../scripts/tts/setup-piper-model";

const posixPathSeparator = String.fromCodePoint(47);
const parentPathSegment = [".."].join("");

describe("Piper setup helper", () => {
  it("prints config paths that match the downloaded Hugging Face files", () => {
    const snippet = piperConfigSnippet();

    expect(snippet.providers.tts).toMatchObject({
      enabled: true,
      mode: "local-piper",
      piperBinary: "piper",
      piperModelPath: "models/piper/tr_TR/fahrettin-medium/model.onnx",
      piperConfigPath: "models/piper/tr_TR/fahrettin-medium/model.onnx.json",
    });
  });

  it("pins the default Turkish Piper voice revision", () => {
    expect(defaultPiperModel.repoId).toBe("speaches-ai/piper-tr_TR-fahrettin-medium");
    expect(defaultPiperModel.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(
      piperModelFileUrl(defaultPiperModel.repoId, defaultPiperModel.revision, "model.onnx"),
    ).toBe(
      "https://huggingface.co/speaches-ai/piper-tr_TR-fahrettin-medium/resolve/aab8f92429ede58091e17de506484a2c84384792/model.onnx",
    );
  });

  it("keeps downloaded models under the ignored models directory", () => {
    expect(normalizeModelDir("models/piper/tr_TR/fahrettin-medium")).toBe(
      "models/piper/tr_TR/fahrettin-medium",
    );
    expect(() => normalizeModelDir(pathSegments(parentPathSegment, "outside"))).toThrow(
      /project root/i,
    );
    expect(() => normalizeModelDir(posixAbsolutePath("outside", "piper"))).toThrow(
      /relative path/i,
    );
    expect(() => normalizeModelDir("assets/piper")).toThrow(/models/i);
  });
});

function posixAbsolutePath(...segments: string[]): string {
  return `${posixPathSeparator}${segments.join(posixPathSeparator)}`;
}

function pathSegments(...segments: string[]): string {
  return segments.join(posixPathSeparator);
}
