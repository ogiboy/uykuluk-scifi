import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GET as getRunMedia } from "../apps/studio/src/app/runs/[runId]/media/[...artifactPath]/route";
import {
  readStudioMediaArtifact,
  studioMediaArtifactUrl,
} from "../apps/studio/src/lib/studioMediaArtifacts";
import { artifactPath } from "../src/core/artifacts";
import { createRun, saveRun } from "../src/core/runStore";
import { useTempProject } from "./helpers";

describe("Studio local media artifacts", () => {
  useTempProject();

  it("builds browser media URLs only for allowlisted local review artifacts", () => {
    expect(studioMediaArtifactUrl("run_media_review", "production/audio/voiceover.wav")).toBe(
      "/runs/run_media_review/media/production/audio/voiceover.wav",
    );
    expect(studioMediaArtifactUrl("run_media_review", "production/render/draft.mp4")).toBe(
      "/runs/run_media_review/media/production/render/draft.mp4",
    );
    expect(studioMediaArtifactUrl("run_media_review", "evidence_bundle.json")).toBeNull();
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
