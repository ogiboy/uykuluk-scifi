import { mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun, mutateRun, runDir } from "../src/core/runStore";
import { prepareStaticVisuals } from "../src/stages/visuals";
import { captureVisualArtifactRollback } from "../src/stages/visuals/visualArtifactRollback";
import { visualMutationRollbackPaths } from "../src/stages/visuals/visualPersistence";
import { writeBinaryFile } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { preparePackagedVisualRun } from "./visualTestHelpers";

describe("scene visual workflow rollback", () => {
  useTempProject();

  it("restores the complete visual artifact set after failures at every mutation phase", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    await mutateRun(runId, async (current) => ({
      run: await writeRunText(
        current,
        "test-visual-rollback",
        "production/render_plan.json",
        "original render plan",
      ),
      value: null,
    }));
    const manifestPath = artifactPath(runId, "production/visuals/manifest.json");
    const contactPath = artifactPath(runId, "production/visuals/contact_sheet.md");
    const consumerPath = artifactPath(runId, "production/render_plan.json");
    const baseline = {
      manifest: await readFile(manifestPath),
      contact: await readFile(contactPath),
      consumer: await readFile(consumerPath),
    };

    for (const phase of ["binary", "manifest", "contact", "state"] as const) {
      const pendingAsset = "production/visuals/scenes/scene_001/revision_099.png";
      await expect(
        mutateRun(runId, async (current, transaction) => {
          transaction.onRollback(
            await captureVisualArtifactRollback(runId, "test-visual-rollback", [
              ...visualMutationRollbackPaths,
              pendingAsset,
            ]),
          );
          await writeBinaryFile(artifactPath(runId, pendingAsset), Buffer.from("pending binary"));
          if (phase === "binary") throw new Error("injected after binary");
          await writeFile(manifestPath, "replacement manifest");
          if (phase === "manifest") throw new Error("injected after manifest");
          await writeFile(contactPath, "replacement contact sheet");
          if (phase === "contact") throw new Error("injected after contact");
          await rm(consumerPath);
          return {
            run: {
              ...current,
              updatedAt: new Date(Date.parse(current.updatedAt) + 1_000).toISOString(),
            },
            value: null,
          };
        }),
      ).rejects.toThrow(phase === "state" ? /run state changed/i : `injected after ${phase}`);

      await expect(readFile(manifestPath)).resolves.toEqual(baseline.manifest);
      await expect(readFile(contactPath)).resolves.toEqual(baseline.contact);
      await expect(readFile(consumerPath)).resolves.toEqual(baseline.consumer);
      await expect(readFile(artifactPath(runId, pendingAsset))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(loadRun(runId)).resolves.toMatchObject({
        artifacts: expect.arrayContaining(["production/render_plan.json"]),
      });
      const rollbackEvent = (await readLedger(runId)).at(-1);
      expect(rollbackEvent).toMatchObject({
        type: "ARTIFACT_ROLLBACK",
        stage: "test-visual-rollback",
        data: {
          failure: { category: expect.any(String), name: expect.any(String) },
          paths: expect.arrayContaining([pendingAsset, "production/visuals/manifest.json"]),
        },
      });
      expect(JSON.stringify(rollbackEvent)).not.toContain(`injected after ${phase}`);
    }
  });

  it("revalidates run containment before restoring a captured artifact", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    const relativePath = "production/visuals/manifest.json";
    const rollback = await captureVisualArtifactRollback(runId, "test-symlink-swap", [
      relativePath,
    ]);
    const visualDirectory = path.join(runDir(runId), "production", "visuals");
    const archivedDirectory = `${visualDirectory}.captured`;
    const outsideDirectory = path.join(process.cwd(), "outside-visual-rollback");
    await mkdir(outsideDirectory);
    const outsideSentinel = path.join(outsideDirectory, "manifest.json");
    await writeFile(outsideSentinel, "outside sentinel\n", "utf8");
    await rename(visualDirectory, archivedDirectory);
    await symlink(outsideDirectory, visualDirectory, "dir");

    await expect(rollback(new Error("secret=/tmp/operator?token=hidden"))).rejects.toThrow(
      /symbolic link|symlink/i,
    );
    await expect(readFile(outsideSentinel, "utf8")).resolves.toBe("outside sentinel\n");
  });

  it("persists only allowlisted rollback failure metadata", async () => {
    const runId = await preparePackagedVisualRun();
    await prepareStaticVisuals(runId);
    const rollback = await captureVisualArtifactRollback(runId, "test-redacted-rollback", [
      "production/visuals/manifest.json",
    ]);
    const failure = new Error("secret=/tmp/operator?token=hidden") as NodeJS.ErrnoException;
    failure.name = "SecretCredentialName";
    failure.code = "SECRET_TOKEN_ABC";

    await rollback(failure);

    const event = (await readLedger(runId)).at(-1);
    expect(event).toMatchObject({
      data: { failure: { category: "unexpected", name: "Error" } },
      type: "ARTIFACT_ROLLBACK",
    });
    expect(JSON.stringify(event)).not.toMatch(/secret|operator|token/i);
  });
});
