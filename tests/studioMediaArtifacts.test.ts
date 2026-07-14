import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { GET as getRunMedia } from "../apps/studio/src/app/runs/[runId]/media/[...artifactPath]/route";
import {
  readStudioMediaArtifact,
  srtToWebVtt,
  studioCaptionArtifactUrl,
  studioMediaArtifactUrl,
} from "../apps/studio/src/lib/artifacts/studioMediaArtifacts";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { candidateVoiceId, prepareVoiceCatalog } from "./voiceAuditionStageFixtures";
import {
  defaultCatalogVoice,
  previewMp3Bytes,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("Studio local media artifacts", () => {
  useTempProject();

  it("builds browser media URLs only for allowlisted local review artifacts", () => {
    expect(studioMediaArtifactUrl("run_media_review", "production/audio/voiceover.wav")).toBe(
      "/runs/run_media_review/media/production/audio/voiceover.wav",
    );
    expect(studioMediaArtifactUrl("run_media_review", "production/render/draft.mp4")).toBe(
      "/runs/run_media_review/media/production/render/draft.mp4",
    );
    expect(
      studioMediaArtifactUrl(
        "run_media_review",
        "production/audio/voice-previews/voice_test/preview_test.mp3",
      ),
    ).toBe(
      "/runs/run_media_review/media/production/audio/voice-previews/voice_test/preview_test.mp3",
    );
    expect(studioCaptionArtifactUrl("run_media_review")).toBe(
      "/runs/run_media_review/media/production/subtitles.vtt",
    );
    expect(studioMediaArtifactUrl("run_media_review", "evidence_bundle.json")).toBeNull();
    expect(
      studioMediaArtifactUrl("run_media_review", "https://provider.example/preview.mp3"),
    ).toBeNull();
  });

  it("streams only the current evidence-bound persisted voice preview", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const evidence = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    const unregisteredPath = `production/audio/voice-previews/${voiceId}/preview_unregistered.mp3`;

    const response = await getRunMedia(mediaRequest(runId, evidence.output.path), {
      params: Promise.resolve({ artifactPath: evidence.output.path.split("/"), runId }),
    });
    const blocked = await getRunMedia(mediaRequest(runId, unregisteredPath), {
      params: Promise.resolve({ artifactPath: unregisteredPath.split("/"), runId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(previewMp3Bytes());
    expect(blocked.status).toBe(404);
  });

  it("rejects superseded and failed preview generations", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const first = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    const second = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });

    await expect(mediaStatus(runId, first.output.path)).resolves.toBe(404);
    await expect(mediaStatus(runId, second.output.path)).resolves.toBe(200);

    const failingProvider = successfulPreviewProvider(catalog);
    await expect(
      generateVoicePreview(runId, voiceId, {
        provider: {
          ...failingProvider,
          async fetchPreview() {
            throw new Error("fixture preview failure");
          },
        },
      }),
    ).rejects.toThrow("could not be recorded safely");
    await expect(mediaStatus(runId, second.output.path)).resolves.toBe(404);
  });

  it("rejects a preview after the current catalog metadata changes", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const evidence = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    await generateVoiceCandidates(runId, {
      provider: successfulCatalogProvider({
        voices: [defaultCatalogVoice({ name: "Refreshed Catalog Voice" })],
      }),
    });

    await expect(mediaStatus(runId, evidence.output.path)).resolves.toBe(404);
  });

  it("rejects stale catalog and tampered preview bytes", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    const evidence = await generateVoicePreview(runId, voiceId, {
      provider: successfulPreviewProvider(catalog),
    });
    await writeFile(
      artifactPath(runId, evidence.output.path),
      Buffer.alloc(evidence.output.bytes, 0x41),
    );
    await expect(mediaStatus(runId, evidence.output.path)).resolves.toBe(404);

    await writeFile(artifactPath(runId, evidence.output.path), previewMp3Bytes());
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1_000);
      await expect(mediaStatus(runId, evidence.output.path)).resolves.toBe(404);
    } finally {
      vi.useRealTimers();
    }
  });

  it("streams an allowlisted voiceover artifact without exposing arbitrary run files", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["production/audio/voiceover.wav"] });
    await mkdir(artifactPath(run.runId, "production/audio"), { recursive: true });
    await writeFile(artifactPath(run.runId, "production/audio/voiceover.wav"), Buffer.from("RIFF"));
    await writeFile(artifactPath(run.runId, "evidence_bundle.json"), "{}");

    const response = await getRunMedia(mediaRequest(run.runId, "production/audio/voiceover.wav"), {
      params: Promise.resolve({
        artifactPath: ["production", "audio", "voiceover.wav"],
        runId: run.runId,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/wav");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("RIFF");

    const blocked = await getRunMedia(mediaRequest(run.runId, "evidence_bundle.json"), {
      params: Promise.resolve({ artifactPath: ["evidence_bundle.json"], runId: run.runId }),
    });
    expect(blocked.status).toBe(404);
  });

  it("converts evidence-backed local subtitles into WebVTT and rejects later tampering", async () => {
    const runId = await prepareVoiceoverReadyRun();
    const subtitlePath = artifactPath(runId, "production/subtitles.srt");
    const expected = srtToWebVtt(await readFile(subtitlePath, "utf8"));

    const response = await getRunMedia(mediaRequest(runId, "production/subtitles.vtt"), {
      params: Promise.resolve({ artifactPath: ["production", "subtitles.vtt"], runId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/vtt; charset=utf-8");
    expect(await response.text()).toBe(expected);

    await writeFile(subtitlePath, `${await readFile(subtitlePath, "utf8")}\nTampered\n`, "utf8");
    const tampered = await getRunMedia(mediaRequest(runId, "production/subtitles.vtt"), {
      params: Promise.resolve({ artifactPath: ["production", "subtitles.vtt"], runId }),
    });
    expect(tampered.status).toBe(404);
  });

  it("rejects a bare subtitle file without registered voice evidence", async () => {
    const run = await createRun();
    await mkdir(artifactPath(run.runId, "production"), { recursive: true });
    await writeFile(
      artifactPath(run.runId, "production/subtitles.srt"),
      "1\n00:00:01,000 --> 00:00:02,500\nMerhaba UykulukSciFi\n",
      "utf8",
    );

    const response = await getRunMedia(mediaRequest(run.runId, "production/subtitles.vtt"), {
      params: Promise.resolve({ artifactPath: ["production", "subtitles.vtt"], runId: run.runId }),
    });

    expect(response.status).toBe(404);
  });

  it("does not expose raw subtitle artifacts through the media route", async () => {
    const run = await createRun();
    await mkdir(artifactPath(run.runId, "production"), { recursive: true });
    await writeFile(artifactPath(run.runId, "production/subtitles.srt"), "1\n", "utf8");

    await expect(
      readStudioMediaArtifact(process.cwd(), run.runId, "production/subtitles.srt", null),
    ).resolves.toEqual({ status: 404 });
  });

  it("supports browser byte ranges for draft render playback", async () => {
    const run = await createRun();
    await saveRun({ ...run, artifacts: ["production/render/draft.mp4"] });
    await mkdir(artifactPath(run.runId, "production/render"), { recursive: true });
    await writeFile(artifactPath(run.runId, "production/render/draft.mp4"), Buffer.from("012345"));

    const result = await readStudioMediaArtifact(
      process.cwd(),
      run.runId,
      "production/render/draft.mp4",
      "bytes=2-4",
    );

    expect(result.status).toBe(206);
    if (result.status !== 206) {
      return;
    }
    const response = new Response(result.body, { headers: result.headers, status: result.status });
    expect(response.headers.get("content-range")).toBe("bytes 2-4/6");
    expect(response.headers.get("content-length")).toBe("3");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("234");
  });

  it("rejects invalid media ranges and traversal-shaped paths", async () => {
    const run = await createRun();
    await mkdir(artifactPath(run.runId, "production/render"), { recursive: true });
    await writeFile(artifactPath(run.runId, "production/render/draft.mp4"), Buffer.from("012345"));

    await expect(
      readStudioMediaArtifact(process.cwd(), run.runId, "../state.json", null),
    ).resolves.toEqual({ status: 404 });
    await expect(
      readStudioMediaArtifact(
        process.cwd(),
        run.runId,
        "production/render/draft.mp4",
        "bytes=20-30",
      ),
    ).resolves.toEqual({ status: 416 });
  });
});

function mediaRequest(runId: string, artifactPath: string): Request {
  return new Request(`http://localhost:3000/runs/${runId}/media/${artifactPath}`);
}

async function mediaStatus(runId: string, relativePath: string): Promise<number> {
  const response = await getRunMedia(mediaRequest(runId, relativePath), {
    params: Promise.resolve({ artifactPath: relativePath.split("/"), runId }),
  });
  return response.status;
}
