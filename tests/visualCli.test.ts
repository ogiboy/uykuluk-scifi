import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRun } from "../src/core/runStore";
import { loadVisualManifest } from "../src/stages/visuals/visualManifest";
import { useTempProject } from "./helpers";
import { preparePackagedVisualRun, writeTestPng } from "./visualTestHelpers";

const repoRoot = process.cwd();

describe("producer visuals CLI", () => {
  useTempProject();

  it("binds decisions to the fresh manifest snapshot", async () => {
    const runId = await preparePackagedVisualRun();
    const prepared = runCli(["visuals", "prepare", "--run", runId, "--json"]);
    expectCliSuccess(prepared);
    const preparedExpectation = await visualMutationCliArgs(runId);

    const rejected = runCli([
      "visuals",
      "decide",
      "--run",
      runId,
      "--scenes",
      "1",
      "--decision",
      "rejected",
      "--reviewed-by",
      "cli-reviewer",
      "--notes",
      "Request the next deterministic fallback.",
      ...preparedExpectation,
      "--json",
    ]);
    expectCliSuccess(rejected);
    const rejectedManifest = JSON.parse(rejected.stdout) as { scenes: unknown[] };
    expect(rejectedManifest.scenes[0]).toMatchObject({
      sceneIndex: 1,
      decision: { status: "rejected" },
    });
  });

  it("binds regeneration to the fresh rejected manifest snapshot", async () => {
    const runId = await preparePackagedVisualRun();
    expectCliSuccess(runCli(["visuals", "prepare", "--run", runId]));
    const preparedExpectation = await visualMutationCliArgs(runId);
    expectCliSuccess(
      runCli([
        "visuals",
        "decide",
        "--run",
        runId,
        "--scenes",
        "1",
        "--decision",
        "rejected",
        "--reviewed-by",
        "cli-reviewer",
        "--notes",
        "Request the next deterministic fallback.",
        ...preparedExpectation,
      ]),
    );

    const rejectedExpectation = await visualMutationCliArgs(runId);
    const regenerated = runCli([
      "visuals",
      "regenerate",
      "--run",
      runId,
      "--scenes",
      "1",
      ...rejectedExpectation,
      "--json",
    ]);
    expectCliSuccess(regenerated);
    const regeneratedManifest = JSON.parse(regenerated.stdout) as { scenes: unknown[] };
    expect(regeneratedManifest.scenes[0]).toMatchObject({
      sceneIndex: 1,
      activeRevision: 2,
      revisions: [
        expect.objectContaining({ revision: 1, provider: "static" }),
        expect.objectContaining({ revision: 2, provider: "static" }),
      ],
    });
  });

  it("binds manual import to the fresh manifest snapshot", async () => {
    const runId = await preparePackagedVisualRun();
    expectCliSuccess(runCli(["visuals", "prepare", "--run", runId]));
    await writeTestPng("manual.png");
    const preparedExpectation = await visualMutationCliArgs(runId);
    const imported = runCli([
      "visuals",
      "import",
      "--run",
      runId,
      "--scene",
      "1",
      "--file",
      "manual.png",
      ...preparedExpectation,
      "--json",
    ]);
    expectCliSuccess(imported);
    const importedManifest = JSON.parse(imported.stdout) as { scenes: unknown[] };
    expect(importedManifest.scenes[0]).toMatchObject({
      sceneIndex: 1,
      activeRevision: 2,
      revisions: expect.arrayContaining([
        expect.objectContaining({ revision: 2, provider: "manual-import" }),
      ]),
    });
  });

  it("keeps regeneration fail-closed when a scene is not rejected", async () => {
    const runId = await preparePackagedVisualRun();
    expectCliSuccess(runCli(["visuals", "prepare", "--run", runId]));
    const expectation = await visualMutationCliArgs(runId);

    const result = runCli([
      "visuals",
      "regenerate",
      "--run",
      runId,
      "--scenes",
      "1",
      ...expectation,
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/must reject its active revision/i);
  });

  it("rejects a stale browser snapshot instead of rebinding to current visuals", async () => {
    const runId = await preparePackagedVisualRun();
    expectCliSuccess(runCli(["visuals", "prepare", "--run", runId]));
    const staleExpectation = await visualMutationCliArgs(runId);

    const first = runCli([
      "visuals",
      "decide",
      "--run",
      runId,
      "--scenes",
      "1",
      "--decision",
      "rejected",
      "--reviewed-by",
      "cli-reviewer",
      "--notes",
      "Reject once.",
      ...staleExpectation,
    ]);
    expectCliSuccess(first);

    const stale = runCli([
      "visuals",
      "decide",
      "--run",
      runId,
      "--scenes",
      "2",
      "--decision",
      "approved",
      "--reviewed-by",
      "cli-reviewer",
      "--notes",
      "This request came from the stale snapshot.",
      ...staleExpectation,
    ]);

    expect(stale.status).toBe(1);
    expect(stale.stderr).toMatch(/visual manifest changed; reload/i);
  });
});

async function visualMutationCliArgs(runId: string): Promise<string[]> {
  const loaded = await loadVisualManifest(await loadRun(runId));
  const filePath = path.join(process.cwd(), `visual-active-revisions-${loaded.digest}.json`);
  await writeFile(
    filePath,
    JSON.stringify(
      loaded.manifest.scenes.map((scene) => ({
        sceneIndex: scene.sceneIndex,
        activeRevision: scene.activeRevision,
      })),
    ),
    "utf8",
  );
  return [
    "--expected-manifest-digest",
    loaded.digest,
    "--expected-active-revisions-file",
    filePath,
  ];
}

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  const tsxLoader = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, path.join(repoRoot, "src", "cli.ts"), ...args],
    { cwd: process.cwd(), encoding: "utf8", timeout: 30_000 },
  );
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}

function expectCliSuccess(result: ReturnType<typeof runCli>): void {
  const diagnostics = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
  expect(result.status, diagnostics).toBe(0);
}
