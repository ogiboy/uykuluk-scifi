import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { artifactPathAtProjectRoot } from "../../core/artifactPaths.js";
import { SafeExitError } from "../../core/errors.js";
import { RunRecord } from "../../core/state.js";
import { pathExists } from "../../utils/fs.js";
import { readJsonFile } from "../../utils/json.js";
import { verifyProductionPackageAtProjectRoot } from "../production/productionPackageIntegrity.js";
import { readApprovedVisualManifestEvidence } from "../visuals/visualManifest.js";
import {
  AssetProvenance,
  assetProvenanceSchema,
  RenderPlan,
  renderPlanArtifactPaths,
  renderPlanSchema,
} from "./renderPlanSchemas.js";

export type RenderPlanEvidence =
  | { status: "missing"; requiredArtifacts: readonly string[] }
  | {
      status: "pass";
      path: string;
      digest: string;
      artifactCount: number;
      assetCount: number;
      visualManifestDigest?: string;
    }
  | { status: "block"; path: string; message: string };

export async function readRenderPlanEvidence(run: RunRecord): Promise<RenderPlanEvidence> {
  return readRenderPlanEvidenceAtProjectRoot(process.cwd(), run);
}

/** Reads render-plan evidence beneath an explicit producer project root. */
export async function readRenderPlanEvidenceAtProjectRoot(
  projectRoot: string,
  run: RunRecord,
): Promise<RenderPlanEvidence> {
  const resolveArtifact = (relativePath: string) =>
    artifactPathAtProjectRoot(projectRoot, run.runId, relativePath);
  const registered = renderPlanArtifactPaths.some((relativePath) =>
    run.artifacts.includes(relativePath),
  );
  const exists = await Promise.all(
    renderPlanArtifactPaths.map((relativePath) => pathExists(resolveArtifact(relativePath))),
  );
  if (!registered && exists.every((item) => !item)) {
    return { status: "missing", requiredArtifacts: renderPlanArtifactPaths };
  }
  try {
    await assertRenderPlanArtifacts(run, resolveArtifact);
    const planText = await readFile(resolveArtifact("production/render_plan.json"), "utf8");
    const plan = renderPlanSchema.parse(JSON.parse(planText) as unknown);
    const provenance = assetProvenanceSchema.parse(
      await readJsonFile(resolveArtifact("production/asset_provenance.json")),
    );
    await assertRenderPlanEvidenceMatchesRun(projectRoot, run, plan, provenance);
    return {
      status: "pass",
      path: "production/render_plan.json",
      digest: createHash("sha256").update(planText, "utf8").digest("hex"),
      artifactCount: renderPlanArtifactPaths.length,
      assetCount: provenance.assets.length,
      ...(plan.schemaVersion === 2 ? { visualManifestDigest: plan.visualManifest.digest } : {}),
    };
  } catch (error) {
    return {
      status: "block",
      path: "production/render_plan.json",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function assertRenderPlanEvidenceMatchesRun(
  projectRoot: string,
  run: RunRecord,
  plan: RenderPlan,
  provenance: AssetProvenance,
): Promise<void> {
  if (plan.runId !== run.runId || provenance.runId !== run.runId) {
    throw new SafeExitError("Render plan evidence belongs to a different run.");
  }
  const { digest } = await verifyProductionPackageAtProjectRoot(projectRoot, run);
  if (plan.productionPackageManifestDigest !== digest) {
    throw new SafeExitError(
      "Render plan evidence was generated from a stale production package manifest.",
    );
  }
  if (plan.schemaVersion === 2) {
    const visualEvidence = await readApprovedVisualManifestEvidence(run, projectRoot);
    if (visualEvidence.status !== "pass" || visualEvidence.digest !== plan.visualManifest.digest) {
      throw new SafeExitError("Render plan evidence was generated from stale visual evidence.");
    }
  }
}

async function assertRenderPlanArtifacts(
  run: RunRecord,
  resolveArtifact: (relativePath: string) => string,
): Promise<void> {
  for (const relativePath of renderPlanArtifactPaths) {
    if (!run.artifacts.includes(relativePath)) {
      throw new SafeExitError(`Render plan artifact is not registered: ${relativePath}.`);
    }
    if (!(await pathExists(resolveArtifact(relativePath)))) {
      throw new SafeExitError(`Render plan artifact is missing: ${relativePath}.`);
    }
  }
}
