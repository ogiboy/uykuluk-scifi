import { copyFile, mkdir, rename, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GET as getVisualMedia } from "../apps/studio/src/app/runs/[runId]/visuals/[sceneIndex]/route";
import { readCoreVisualRunRecord } from "../apps/studio/src/lib/runs/visualRunRecord";
import { readStudioVisualSummary } from "../apps/studio/src/lib/runs/visualSummaries";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun, statePath } from "../src/core/runStore";
import { localModelStatePaths, writeLocalModelReady } from "../src/localModels/localModelStore";
import { decideVisuals, importManualVisual, prepareStaticVisuals } from "../src/stages/visuals";
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
        "visuals.generate-hosted": null,
        "visuals.import": { routePath: "/actions/visuals-import" },
        "visuals.plan-hosted": null,
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
    await saveRun({ ...run, state: "READY_FOR_MANUAL_PRODUCTION" });
    const ready = await readStudioVisualSummary(process.cwd(), runId);
    expect(ready.actions).toMatchObject({
      "visuals.decide": { routePath: "/actions/visuals-decide" },
      "visuals.generate-hosted": null,
      "visuals.generate-local": null,
      "visuals.plan-hosted": null,
    });
    expect(ready.local).toMatchObject({
      enabled: false,
      mode: "static-manual",
      readiness: "absent",
    });

    const localPaths = localModelStatePaths(process.cwd());
    await mkdir(localPaths.runtimePath, { recursive: true });
    await writeFile(localPaths.installManifestPath, "{}\n", "utf8");
    await writeLocalModelReady(localPaths.readyPath);
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            imageGeneration: {
              ...defaultConfig.providers.imageGeneration,
              enabled: true,
              mode: "mflux-local",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const localReady = await readStudioVisualSummary(process.cwd(), runId);
    expect(localReady).toMatchObject({
      actions: { "visuals.generate-local": { routePath: "/actions/visuals-generate-local" } },
      local: { enabled: true, mode: "mflux-local", readiness: "ready" },
    });
    await decideVisuals({
      ...(await currentVisualExpectation(runId)),
      notes: "Hosted regeneration is available only after an explicit rejection.",
      reviewedBy: "visual director",
      runId,
      sceneIndexes: [1],
      status: "rejected",
    });
    const readyWithRejection = await readStudioVisualSummary(process.cwd(), runId);
    expect(readyWithRejection.actions["visuals.plan-hosted"]).toBeNull();
    await saveRun({ ...(await loadRun(runId)), state: "PAID_GENERATION_COST_APPROVED" });
    const paid = await readStudioVisualSummary(process.cwd(), runId);
    expect(paid.actions).toMatchObject({
      "visuals.decide": { routePath: "/actions/visuals-decide" },
      "visuals.generate-hosted": null,
      "visuals.plan-hosted": null,
    });
    await saveRun({ ...(await loadRun(runId)), state: "COST_ESTIMATED" });
    const unavailable = await readStudioVisualSummary(process.cwd(), runId);
    expect(Object.values(unavailable.actions)).toEqual(
      Array.from({ length: Object.keys(unavailable.actions).length }, () => null),
    );
  });

  it("serves verified revision history and rejects missing, stale, traversal-shaped, or tampered media requests", async () => {
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
    const historical = scene.revisions.find((revision) => revision.revision === 1);
    expect(historical).toMatchObject({
      providerId: "static",
      revision: 1,
      sourceKind: "static-fallback",
    });

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

    const historicalResponse = await visualResponse(historical!.mediaUrl, runId, scene.sceneIndex);
    expect(historicalResponse.status).toBe(200);
    expect(historicalResponse.headers.get("content-type")).toMatch(/^image\//);

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

  it("keeps invalid hosted configuration visible to the operator", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await writeFile("producer.config.json", "{not-json", "utf8");

    const summary = await readStudioVisualSummary(process.cwd(), runId);

    expect(summary.kind).toBe("ready");
    expect(summary.hosted).toMatchObject({
      blockedReason: expect.stringMatching(/config/i),
      mode: "unknown",
    });
  });

  it("refuses static visual media reached through a linked project asset directory", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    const summary = await readStudioVisualSummary(process.cwd(), runId);
    const scene = summary.scenes[0]!;
    const backgrounds = path.join(process.cwd(), "assets", "backgrounds");
    const archived = path.join(process.cwd(), "assets", "backgrounds-original");
    const outside = path.join(process.cwd(), "outside-backgrounds");
    await rename(backgrounds, archived);
    await mkdir(outside);
    await copyFile(
      path.join(archived, path.basename(scene.assetPath)),
      path.join(outside, path.basename(scene.assetPath)),
    );
    await symlink(outside, backgrounds, "dir");

    await expect(visualResponse(scene.mediaUrl, runId, scene.sceneIndex)).resolves.toMatchObject({
      status: 404,
    });
  });

  it("refuses a final static visual asset symlink", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    const summary = await readStudioVisualSummary(process.cwd(), runId);
    const scene = summary.scenes[0]!;
    const target = path.join(process.cwd(), scene.assetPath);
    const archived = `${target}.original`;
    await rename(target, archived);
    await symlink(archived, target, "file");

    await expect(visualResponse(scene.mediaUrl, runId, scene.sceneIndex)).resolves.toMatchObject({
      status: 404,
    });
  });

  it("surfaces malformed or mismatched persisted run state instead of hiding it as missing", async () => {
    const runId = await preparePackagedVisualRun();
    const run = await loadRun(runId);
    await writeFile(
      statePath(runId),
      `${JSON.stringify({ ...run, runId: "run_mismatched_visual_state" }, null, 2)}\n`,
      "utf8",
    );

    await expect(readCoreVisualRunRecord(process.cwd(), runId)).rejects.toThrow(
      /persisted run id does not match/i,
    );

    await writeFile(statePath(runId), "{not-json", "utf8");
    await expect(readCoreVisualRunRecord(process.cwd(), runId)).rejects.toThrow(
      /run state is invalid/i,
    );
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
