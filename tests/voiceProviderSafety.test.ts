import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { DeterministicReferenceTtsProvider } from "../src/stages/voice/providers/deterministicReferenceTtsProvider";
import { PiperTtsProvider } from "../src/stages/voice/providers/piperTtsProvider";
import { voiceoverAudioMetaSchema } from "../src/stages/voice/voiceoverEvidence";
import { voiceoverAudioPath } from "../src/stages/voice/voiceoverPaths";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { voiceoverMetaFixture } from "./voiceTestFixtures";

describe("voice provider safety", () => {
  useTempProject();

  it("terminates a Piper process that exceeds the bounded timeout", async () => {
    const binary = path.resolve("scripts/fake-piper-timeout-test.mjs");
    const modelPath = path.resolve("models/piper/test/timeout-model.onnx");
    await mkdir(path.dirname(binary), { recursive: true });
    await mkdir(path.dirname(modelPath), { recursive: true });
    await writeFile(modelPath, "fake local Piper timeout model", "utf8");
    await writeFile(
      binary,
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const outputIndex = process.argv.indexOf("--output_file");
writeFileSync(process.argv[outputIndex + 1], "partial output");
process.on("SIGTERM", () => undefined);
setInterval(() => undefined, 1_000);
`,
      "utf8",
    );
    await chmod(binary, 0o755);
    const provider = new PiperTtsProvider({ binary, modelPath, timeoutMs: 50 });

    await expect(
      provider.synthesize({ runId: "run_piper_timeout", text: "zaman aşımı" }),
    ).rejects.toThrow(/Piper timed out after 50ms/i);
    expect(await pathExists(artifactPath("run_piper_timeout", voiceoverAudioPath))).toBe(false);
  });

  it("uses the full deterministic reference duration below the 20-minute limit", async () => {
    const provider = new DeterministicReferenceTtsProvider();

    const result = await provider.synthesize({ text: Array(120).fill("kelime").join(" ") });

    expect(result.durationSeconds).toBe(50);
  });

  it("rejects deterministic reference narration longer than 20 minutes", async () => {
    const provider = new DeterministicReferenceTtsProvider();

    await expect(
      provider.synthesize({ text: Array(2_881).fill("kelime").join(" ") }),
    ).rejects.toThrow(/20-minute duration/i);
  });

  it("rejects local Piper metadata without model provenance digests", () => {
    expect(() =>
      voiceoverAudioMetaSchema.parse({
        ...voiceoverMetaFixture(),
        mode: "local-piper",
        quality: "local-piper",
        provider: { binary: "piper", modelPath: "models/piper/model.onnx" },
      }),
    ).toThrow(/modelSha256/);
  });
});
