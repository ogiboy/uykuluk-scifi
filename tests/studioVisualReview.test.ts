import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GET as getVisualMedia } from "../apps/studio/src/app/runs/[runId]/visuals/[sceneIndex]/route";
import { readStudioVisualSummary } from "../apps/studio/src/lib/runs/visualSummaries";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { importManualVisual, prepareStaticVisuals } from "../src/stages/visuals";
import { useTempProject } from "./helpers";
import {
  currentVisualExpectation,
  preparePackagedVisualRun,
  writeTestPng,
} from "./visualTestHelpers";

describe("Studio visual review read model", () => {
  useTempProject();

  it("exposes the exact mutation snapshot and versioned active media URLs", async () => {
    const runId = await preparePackagedVisualRun();
    const manifest = await prepareStaticVisuals(runId);

    const summary = await readStudioVisualSummary(process.cwd(), runId);

    expect(summary).toMatchObject({
      activeRevisions: manifest.scenes.map((scene) => ({
        activeRevision: scene.activeRevision,
        sceneIndex: scene.sceneIndex,
      })),
      actions: {
        "visuals.decide": { routePath: "/actions/visuals-decide" },
        "visuals.import": { routePath: "/actions/visuals-import" },
        "visuals.prepare": null,
        "visuals.regenerate": { routePath: "/actions/visuals-regenerate" },
      },
      kind: "ready",
      manifestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const firstUrl = new URL(summary.scenes[0]!.mediaUrl, "http://localhost:3000");
    expect(firstUrl.searchParams.get("manifestDigest")).toBe(summary.manifestDigest);
    expect(firstUrl.searchParams.get("revision")).toBe("1");

    const run = await loadRun(runId);
    await saveRun({ ...run, state: "COST_ESTIMATED" });
    const unavailable = await readStudioVisualSummary(process.cwd(), runId);
    expect(Object.values(unavailable.actions)).toEqual([null, null, null, null]);
  });

  it("supports ranges and rejects missing, stale, traversal-shaped, or tampered media requests", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await writeTestPng("manual.png");
    await importManualVisual({
      ...(await currentVisualExpectation(runId)),
      runId,
      sceneIndex: 1,
      sourcePath: "manual.png",
    });
    const summary = await readStudioVisualSummary(process.cwd(), runId);
    const scene = summary.scenes[0]!;

    const full = await visualResponse(scene.mediaUrl, runId, scene.sceneIndex);
    expect(full.status).toBe(200);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("content-type")).toBe("image/png");

    const partial = await visualResponse(scene.mediaUrl, runId, scene.sceneIndex, {
      range: "bytes=0-3",
    });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toMatch(/^bytes 0-3\//);
    expect(Buffer.from(await partial.arrayBuffer())).toEqual(
      Buffer.from(await full.arrayBuffer()).subarray(0, 4),
    );

    await expect(visualResponse(`/runs/${runId}/visuals/1`, runId, 1)).resolves.toMatchObject({
      status: 404,
    });
    const staleUrl = new URL(scene.mediaUrl, "http://localhost:3000");
    staleUrl.searchParams.set("manifestDigest", "f".repeat(64));
    await expect(
      visualResponse(staleUrl.pathname + staleUrl.search, runId, 1),
    ).resolves.toMatchObject({ status: 404 });
    await expect(
      visualResponse(scene.mediaUrl, "../run_escape", scene.sceneIndex),
    ).resolves.toMatchObject({ status: 404 });
    await expect(
      visualResponse(scene.mediaUrl, runId, scene.sceneIndex, { range: "bytes=999999999-" }),
    ).resolves.toMatchObject({ status: 416 });

    await writeFile(artifactPath(runId, scene.assetPath), "tampered", "utf8");
    await expect(visualResponse(scene.mediaUrl, runId, scene.sceneIndex)).resolves.toMatchObject({
      status: 404,
    });
  });
});

async function visualResponse(
  mediaUrl: string,
  runId: string,
  sceneIndex: number,
  headers: HeadersInit = {},
): Promise<Response> {
  return getVisualMedia(new Request(new URL(mediaUrl, "http://localhost:3000"), { headers }), {
    params: Promise.resolve({ runId, sceneIndex: String(sceneIndex) }),
  });
}
