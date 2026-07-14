import { readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun, mutateRun } from "../src/core/runStore";
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
          failure: expect.stringMatching(
            phase === "state" ? /run state changed/i : new RegExp(`injected after ${phase}`, "i"),
          ),
          paths: expect.arrayContaining([pendingAsset, "production/visuals/manifest.json"]),
        },
      });
    }
  });
});
