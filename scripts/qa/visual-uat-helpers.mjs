import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Prepares and approves deterministic scene visuals through the public producer CLI. */
export async function prepareAndApproveVisuals({ pnpm, reviewer, run, runId, scenario, workdir }) {
  run([pnpm, "producer", "visuals", "prepare", "--run", runId], {
    expectOutput: "Prepared",
    label: "prepare deterministic scene visuals",
    scenario,
  });
  const manifestPath = path.join(workdir, "runs", runId, "production", "visuals", "manifest.json");
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const expectationPath = path.join(workdir, `${runId}-visual-active-revisions.json`);
  await writeFile(
    expectationPath,
    JSON.stringify(
      manifest.scenes.map((scene) => ({
        activeRevision: scene.activeRevision,
        sceneIndex: scene.sceneIndex,
      })),
    ),
    "utf8",
  );
  run(
    [
      pnpm,
      "producer",
      "visuals",
      "decide",
      "--run",
      runId,
      "--scenes",
      manifest.scenes.map((scene) => scene.sceneIndex).join(","),
      "--decision",
      "approved",
      "--reviewed-by",
      reviewer,
      "--notes",
      "Approved deterministic visual fallback for automated product validation.",
      "--expected-manifest-digest",
      createHash("sha256").update(manifestBytes).digest("hex"),
      "--expected-active-revisions-file",
      expectationPath,
    ],
    { expectOutput: "Recorded approved", label: "approve deterministic scene visuals", scenario },
  );
}
