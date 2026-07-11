import { readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { sha256 } from "../src/utils/hash";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

const packageArtifactPaths = [
  "production/voiceover.txt",
  "production/subtitles.srt",
  "production/scenes.json",
  "production/youtube_metadata.json",
  "production/production_package.md",
] as const;

describe("production package integrity", () => {
  useTempProject();

  it("writes a versioned manifest for the complete generated package", async () => {
    const runId = await preparePackagedRun();
    const script = await readFile(artifactPath(runId, "script.md"), "utf8");
    const manifest = await readJsonFile<{
      schemaVersion: number;
      runId: string;
      approvedScriptDigest: string;
      artifacts: Array<{ path: string; digest: string }>;
    }>(artifactPath(runId, "production/production_package.meta.json"));

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      runId,
      approvedScriptDigest: sha256(script),
    });
    expect(manifest.artifacts).toEqual(
      await Promise.all(
        packageArtifactPaths.map(async (relativePath) => ({
          path: relativePath,
          digest: sha256(await readFile(artifactPath(runId, relativePath), "utf8")),
        })),
      ),
    );
  });

  it.each(packageArtifactPaths)(
    "blocks cost estimation when %s is modified after generation",
    async (relativePath) => {
      const runId = await preparePackagedRun();
      const target = artifactPath(runId, relativePath);
      await writeFile(target, `${await readFile(target, "utf8")}\ntampered\n`, "utf8");

      await expect(estimateCost(runId)).rejects.toThrow(/production package|integrity|digest/i);
      expect((await loadRun(runId)).state).toBe("PRODUCTION_PACKAGE_GENERATED");
    },
  );

  it.each(packageArtifactPaths)(
    "blocks cost estimation when %s is missing after generation",
    async (relativePath) => {
      const runId = await preparePackagedRun();
      await rm(artifactPath(runId, relativePath));

      await expect(estimateCost(runId)).rejects.toThrow(/production package|integrity|missing/i);
      expect((await loadRun(runId)).state).toBe("PRODUCTION_PACKAGE_GENERATED");
    },
  );

  it("blocks cost estimation when the manifest belongs to another run", async () => {
    const runId = await preparePackagedRun();
    const target = artifactPath(runId, "production/production_package.meta.json");
    const manifest = await readJsonFile<Record<string, unknown>>(target);
    await writeFile(
      target,
      `${JSON.stringify({ ...manifest, runId: "run_00000000-0000-4000-8000-000000000000" }, null, 2)}\n`,
      "utf8",
    );

    await expect(estimateCost(runId)).rejects.toThrow(/different run|production package/i);
    expect((await loadRun(runId)).state).toBe("PRODUCTION_PACKAGE_GENERATED");
  });

  it("blocks cost estimation when the manifest is missing", async () => {
    const runId = await preparePackagedRun();
    await rm(artifactPath(runId, "production/production_package.meta.json"));

    await expect(estimateCost(runId)).rejects.toThrow(/production package|manifest|missing/i);
    expect((await loadRun(runId)).state).toBe("PRODUCTION_PACKAGE_GENERATED");
  });

  it("blocks cost estimation when the approved script changes after packaging", async () => {
    const runId = await preparePackagedRun();
    const target = artifactPath(runId, "script.md");
    await writeFile(target, `${await readFile(target, "utf8")}\ntampered\n`, "utf8");

    await expect(estimateCost(runId)).rejects.toThrow(/approved script|production package/i);
    expect((await loadRun(runId)).state).toBe("PRODUCTION_PACKAGE_GENERATED");
  });

  it("reports package tampering in the evidence bundle", async () => {
    const runId = await preparePackagedRun();
    const target = artifactPath(runId, "production/scenes.json");
    await writeFile(target, `${await readFile(target, "utf8")}\ntampered\n`, "utf8");

    await generateEvidenceBundle(runId);

    const evidence = await readJsonFile<{
      productionPackageIntegrity: { status: string; path: string; message: string };
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(evidence.productionPackageIntegrity).toMatchObject({
      status: "block",
      path: "production/production_package.meta.json",
      message: expect.stringMatching(/scenes\.json|changed|integrity/i),
    });
  });

  it("reports a deleted registered manifest as blocked evidence", async () => {
    const runId = await preparePackagedRun();
    await rm(artifactPath(runId, "production/production_package.meta.json"));

    await generateEvidenceBundle(runId);

    const evidence = await readJsonFile<{
      productionPackageIntegrity: { status: string; path: string; message: string };
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(evidence.productionPackageIntegrity).toMatchObject({
      status: "block",
      path: "production/production_package.meta.json",
      message: expect.stringMatching(/missing|integrity/i),
    });
  });

  it.each(packageArtifactPaths)(
    "blocks readiness when %s changes after the cost estimate",
    async (relativePath) => {
      const runId = await preparePackagedRun();
      await estimateCost(runId);
      const target = artifactPath(runId, relativePath);
      await writeFile(target, `${await readFile(target, "utf8")}\ntampered\n`, "utf8");

      const readiness = await runReadiness(runId);

      expect(readiness.passed).toBe(false);
      expect(
        readiness.checks.find((check) => check.name === "production package integrity"),
      ).toMatchObject({
        status: "block",
        message: expect.stringMatching(/changed|digest|integrity/i),
      });
      expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
    },
  );

  it("blocks readiness when the manifest changes after the cost estimate", async () => {
    const runId = await preparePackagedRun();
    await estimateCost(runId);
    const target = artifactPath(runId, "production/production_package.meta.json");
    await writeFile(target, `${await readFile(target, "utf8")}\ntampered\n`, "utf8");

    const readiness = await runReadiness(runId);

    expect(readiness.passed).toBe(false);
    expect(
      readiness.checks.find((check) => check.name === "production package integrity"),
    ).toMatchObject({
      status: "block",
      message: expect.stringMatching(/integrity|manifest|json/i),
    });
    expect((await loadRun(runId)).state).toBe("COST_ESTIMATED");
  });
});

async function preparePackagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}
