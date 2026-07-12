import { readFile } from "node:fs/promises";
import { z } from "zod";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { RunRecord } from "../../core/state.js";
import { PromptProvenance } from "../../prompts/provenance.js";
import { pathExists } from "../../utils/fs.js";
import { sha256 } from "../../utils/hash.js";
import {
  productionPackageArtifactPaths,
  productionPackageManifestPath,
} from "./productionPackagePaths.js";

export {
  productionPackageArtifactPaths,
  productionPackageManifestPath,
} from "./productionPackagePaths.js";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const promptProvenanceSchema = z.strictObject({
  key: z.literal("production-package"),
  hash: digestSchema,
  artifact: z.literal("production/production_package.md"),
  source: z.string().min(1),
});
const packageArtifactSchema = z.strictObject({
  path: z.enum(productionPackageArtifactPaths),
  digest: digestSchema,
});

export const productionPackageManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  approvedScriptDigest: digestSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokensApprox: z.int().nonnegative().optional(),
  outputTokensApprox: z.int().nonnegative().optional(),
  durationMs: z.number().nonnegative(),
  prompt: promptProvenanceSchema,
  artifacts: z.array(packageArtifactSchema).length(productionPackageArtifactPaths.length),
});

export type ProductionPackageManifest = z.infer<typeof productionPackageManifestSchema>;
export type ProductionPackageIntegrityEvidence =
  | { status: "pass"; path: string; digest: string; artifactCount: number }
  | { status: "block"; path: string; message: string }
  | null;

type ProductionPackageProviderEvidence = {
  provider: string;
  model: string;
  inputTokensApprox?: number;
  outputTokensApprox?: number;
  durationMs: number;
  prompt: PromptProvenance;
};

export function providerEvidenceFromManifest(
  manifest: ProductionPackageManifest,
): ProductionPackageProviderEvidence {
  return {
    provider: manifest.provider,
    model: manifest.model,
    inputTokensApprox: manifest.inputTokensApprox,
    outputTokensApprox: manifest.outputTokensApprox,
    durationMs: manifest.durationMs,
    prompt: manifest.prompt,
  };
}

export async function createProductionPackageManifest(
  run: RunRecord,
  approvedScriptDigest: string,
  providerEvidence: ProductionPackageProviderEvidence,
): Promise<ProductionPackageManifest> {
  const artifacts = await Promise.all(
    productionPackageArtifactPaths.map(async (relativePath) => ({
      path: relativePath,
      digest: sha256(await readPackageArtifact(run.runId, relativePath)),
    })),
  );
  return productionPackageManifestSchema.parse({
    schemaVersion: 1,
    runId: run.runId,
    approvedScriptDigest,
    ...providerEvidence,
    artifacts,
  });
}

export async function verifyProductionPackage(
  run: RunRecord,
): Promise<{ manifest: ProductionPackageManifest; digest: string }> {
  try {
    const manifestText = await readPackageArtifact(run.runId, productionPackageManifestPath);
    const manifest = productionPackageManifestSchema.parse(JSON.parse(manifestText) as unknown);
    if (manifest.runId !== run.runId) {
      throw new SafeExitError("Production package manifest belongs to a different run.");
    }
    const manifestPaths = manifest.artifacts.map((artifact) => artifact.path);
    if (JSON.stringify(manifestPaths) !== JSON.stringify(productionPackageArtifactPaths)) {
      throw new SafeExitError(
        "Production package manifest does not contain the exact required artifact set.",
      );
    }
    for (const relativePath of [...productionPackageArtifactPaths, productionPackageManifestPath]) {
      if (!run.artifacts.includes(relativePath)) {
        throw new SafeExitError(
          `Production package artifact is not registered in run state: ${relativePath}.`,
        );
      }
    }
    const script = await readPackageArtifact(run.runId, "script.md");
    const scriptDigest = sha256(script);
    const scriptApprovalExists = run.approvals.some(
      (approval) =>
        approval.runId === run.runId &&
        approval.target === "script" &&
        approval.approvedRef === manifest.approvedScriptDigest,
    );
    if (!scriptApprovalExists || manifest.approvedScriptDigest !== scriptDigest) {
      throw new SafeExitError(
        "Production package does not match the currently approved script digest.",
      );
    }
    for (const artifact of manifest.artifacts) {
      const currentDigest = sha256(await readPackageArtifact(run.runId, artifact.path));
      if (currentDigest !== artifact.digest) {
        throw new SafeExitError(
          `Production package artifact changed after generation: ${artifact.path}.`,
        );
      }
    }
    return { manifest, digest: sha256(manifestText) };
  } catch (error) {
    if (
      error instanceof SafeExitError &&
      error.message.startsWith("Production package integrity check failed:")
    ) {
      throw error;
    }
    throw new SafeExitError(
      `Production package integrity check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function readProductionPackageIntegrityEvidence(
  run: RunRecord,
): Promise<ProductionPackageIntegrityEvidence> {
  const manifestExists = await pathExists(artifactPath(run.runId, productionPackageManifestPath));
  if (!manifestExists && !run.artifacts.includes(productionPackageManifestPath)) {
    return null;
  }
  try {
    const { manifest, digest } = await verifyProductionPackage(run);
    return {
      status: "pass",
      path: productionPackageManifestPath,
      digest,
      artifactCount: manifest.artifacts.length,
    };
  } catch (error) {
    return {
      status: "block",
      path: productionPackageManifestPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readPackageArtifact(runId: string, relativePath: string): Promise<string> {
  try {
    return await readFile(artifactPath(runId, relativePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new SafeExitError(`Production package artifact is missing: ${relativePath}.`);
    }
    throw error;
  }
}
