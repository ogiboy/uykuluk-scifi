import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { createRun } from "../src/core/runStore";
import {
  ttsConfigurationDigest,
  voiceAuditionArtifactRevision,
  voiceAuditionPathRevision,
} from "../src/stages/voice/catalog/voiceAuditionRevision";
import { useTempProject } from "./helpers";

describe("voice audition artifact revision", () => {
  useTempProject();

  it("reads exact audition bytes from an explicit Studio project root", async () => {
    const run = await createRun();
    const projectRoot = path.join(process.cwd(), "alternate-project");
    const relativePath = "production/audio/voice-selections/selection.json";
    const target = path.join(projectRoot, "runs", run.runId, ...relativePath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, '{"version":1}', "utf8");

    const first = await voiceAuditionArtifactRevision(
      { runId: run.runId, artifacts: [relativePath] },
      [relativePath],
      projectRoot,
    );
    await writeFile(target, '{"version":2}', "utf8");
    const second = await voiceAuditionArtifactRevision(
      { runId: run.runId, artifacts: [relativePath] },
      [relativePath],
      projectRoot,
    );

    expect(second).not.toBe(first);
  });

  it("does not stale audition evidence for downstream review artifacts", async () => {
    const run = await createRun();
    const baseline = voiceAuditionPathRevision(run.artifacts);
    const downstreamArtifacts = [
      "diagnostics/readiness.json",
      "production/render_decision.json",
      "production/final_review_bundle.json",
      "production/channel_handoff.json",
      "reviews/voiceover.md",
    ];

    const afterReviews = voiceAuditionPathRevision(downstreamArtifacts);

    expect(afterReviews).toBe(baseline);
  });

  it("hashes only behaviorally active TTS settings with canonical key ordering", () => {
    const disabledWithPaths = { ...defaultConfig.providers.tts, piperModelPath: "models/one.onnx" };
    expect(ttsConfigurationDigest(disabledWithPaths)).toBe(
      ttsConfigurationDigest({ ...disabledWithPaths, piperModelPath: "models/two.onnx" }),
    );

    const hosted = {
      ...defaultConfig.providers.tts,
      enabled: true,
      mode: "elevenlabs" as const,
      pronunciationReplacements: { NASA: "Nasa", ESA: "Esa" },
      elevenLabs: { ...defaultConfig.providers.tts.elevenLabs, voiceId: "legacy-one" },
    };
    expect(ttsConfigurationDigest(hosted)).toBe(
      ttsConfigurationDigest({
        ...hosted,
        pronunciationReplacements: { ESA: "Esa", NASA: "Nasa" },
        elevenLabs: { ...hosted.elevenLabs, voiceId: "legacy-two" },
      }),
    );
  });
});
