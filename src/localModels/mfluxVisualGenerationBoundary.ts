import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { mfluxLocalConfigSchema } from "../config/imageGenerationSchema.js";
import { SafeExitError } from "../core/errors.js";
import { projectRunPath } from "../core/runPaths.js";
import type {
  LocalVisualGenerationBoundary,
  LocalVisualLaunchPlan,
} from "../stages/visuals/localVisualGeneration.js";
import { canonicalJsonDigest } from "../utils/canonicalJsonDigest.js";
import { pathExists, writeBinaryFile } from "../utils/fs.js";
import { writeJsonFile } from "../utils/json.js";
import { nowIso } from "../utils/time.js";
import { readOverview } from "./localModelReadiness.js";
import { localModelStatePaths } from "./localModelStore.js";
import { executeMfluxWorker } from "./mfluxProcess.js";

type MfluxLocalConfig = z.infer<typeof mfluxLocalConfigSchema>;
type MfluxBoundaryDependencies = Readonly<{
  executeWorker?: typeof executeMfluxWorker;
  readLocalOverview?: typeof readOverview;
}>;

const localVisualSpoolSchema = z.strictObject({
  schemaVersion: z.literal(1),
  operationId: z.string().regex(/^local_image_[a-f0-9]{64}$/),
  promptDigest: z.string().regex(/^[a-f0-9]{64}$/),
  settingsDigest: z.string().regex(/^[a-f0-9]{64}$/),
  seed: z.int().nonnegative().max(2_147_483_647),
  imageDigest: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.int().positive(),
  durationMs: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
});

/** Creates the production adapter for sequential, already-installed local MFLUX inference. */
export function createMfluxVisualGenerationBoundary(
  projectRoot: string,
  config: MfluxLocalConfig,
  dependencies: MfluxBoundaryDependencies = {},
): LocalVisualGenerationBoundary {
  const root = path.resolve(projectRoot);
  const paths = localModelStatePaths(root);
  const settings = {
    runtimeVersion: config.runtimeVersion,
    modelId: config.modelId,
    modelRevision: config.modelRevision,
    quantization: config.quantization,
    width: config.width,
    height: config.height,
    steps: config.steps,
    guidance: config.guidance,
  } as const;
  const settingsDigest = canonicalJsonDigest(settings, {
    nonFiniteNumber: "Local visual settings contain a non-finite number.",
    unsupportedValue: "Local visual settings contain an unsupported value.",
  });

  return {
    async ensureReady(input) {
      const overview = await (dependencies.readLocalOverview ?? readOverview)(root);
      if (overview.readiness !== "ready") {
        throw new SafeExitError(
          "Local FLUX is not ready. Complete the reviewed setup and verification in Studio Settings.",
        );
      }
      const seed = deterministicSeed(config.seedBase, input.sceneIndex, input.revision);
      const operationDigest = createHash("sha256")
        .update(
          JSON.stringify({
            runId: input.runId,
            sceneIndex: input.sceneIndex,
            revision: input.revision,
            promptDigest: input.promptDigest,
            settingsDigest,
            seed,
          }),
        )
        .digest("hex");
      return {
        runId: input.runId,
        sceneIndex: input.sceneIndex,
        revision: input.revision,
        visualPrompt: input.visualPrompt,
        source: {
          kind: "local-generation",
          service: "mflux",
          modelId: config.modelId,
          modelRevision: config.modelRevision,
          runtimeRevision: config.runtimeVersion,
          operationId: `local_image_${operationDigest}`,
          settingsDigest,
          promptDigest: input.promptDigest,
          quantization: config.quantization,
          seed,
          steps: config.steps,
          guidance: config.guidance,
          dimensions: { width: config.width, height: config.height },
        },
      } satisfies LocalVisualLaunchPlan;
    },

    async generate(plan) {
      return withGenerationLock(paths.runtimePath, async () => {
        const recovered = await readGenerationSpool(root, plan);
        if (recovered) return recovered;
        const jobPath = await createGenerationJob(paths.runtimePath, plan);
        try {
          const result = await (dependencies.executeWorker ?? executeMfluxWorker)(
            root,
            {
              operation: "generate",
              outputPath: jobPath.outputPath,
              promptPath: jobPath.promptPath,
              runtimePath: paths.runtimePath,
              seed: plan.source.seed,
            },
            config.timeoutMs,
          );
          if (result.durationMs === undefined) {
            throw new SafeExitError("The local MFLUX worker omitted generation timing evidence.");
          }
          const generated = {
            bytes: await readFile(jobPath.outputPath),
            durationMs: result.durationMs,
            operationId: plan.source.operationId,
          };
          await persistGenerationSpool(root, plan, generated);
          return generated;
        } finally {
          await rm(jobPath.root, { recursive: true, force: true });
        }
      });
    },
  };
}

async function readGenerationSpool(
  projectRoot: string,
  plan: LocalVisualLaunchPlan,
): Promise<Readonly<{ bytes: Buffer; durationMs: number; operationId: string }> | undefined> {
  const paths = generationSpoolPaths(projectRoot, plan);
  const [hasImage, hasEvidence] = await Promise.all([
    pathExists(paths.imagePath),
    pathExists(paths.evidencePath),
  ]);
  if (!hasImage && !hasEvidence) return undefined;
  if (!hasImage || !hasEvidence) {
    throw new SafeExitError(
      `Local visual recovery evidence is incomplete for scene ${plan.sceneIndex}.`,
    );
  }
  let evidence: z.infer<typeof localVisualSpoolSchema>;
  try {
    evidence = localVisualSpoolSchema.parse(JSON.parse(await readFile(paths.evidencePath, "utf8")));
  } catch {
    throw new SafeExitError(
      `Local visual recovery evidence is invalid for scene ${plan.sceneIndex}.`,
    );
  }
  if (
    evidence.operationId !== plan.source.operationId ||
    evidence.promptDigest !== plan.source.promptDigest ||
    evidence.settingsDigest !== plan.source.settingsDigest ||
    evidence.seed !== plan.source.seed
  ) {
    throw new SafeExitError(
      `Local visual recovery evidence is stale for scene ${plan.sceneIndex}.`,
    );
  }
  const bytes = await readFile(paths.imagePath);
  if (bytes.byteLength !== evidence.bytes || sha256(bytes) !== evidence.imageDigest) {
    throw new SafeExitError(`Local visual recovery media is invalid for scene ${plan.sceneIndex}.`);
  }
  return { bytes, durationMs: evidence.durationMs, operationId: evidence.operationId };
}

async function persistGenerationSpool(
  projectRoot: string,
  plan: LocalVisualLaunchPlan,
  generated: Readonly<{ bytes: Buffer; durationMs: number; operationId: string }>,
): Promise<void> {
  const paths = generationSpoolPaths(projectRoot, plan);
  await writeBinaryFile(paths.imagePath, generated.bytes);
  try {
    await writeJsonFile(
      paths.evidencePath,
      localVisualSpoolSchema.parse({
        schemaVersion: 1,
        operationId: generated.operationId,
        promptDigest: plan.source.promptDigest,
        settingsDigest: plan.source.settingsDigest,
        seed: plan.source.seed,
        imageDigest: sha256(generated.bytes),
        bytes: generated.bytes.byteLength,
        durationMs: generated.durationMs,
        createdAt: nowIso(),
      }),
    );
  } catch (error) {
    await rm(paths.imagePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function generationSpoolPaths(projectRoot: string, plan: LocalVisualLaunchPlan) {
  const fileName = plan.source.operationId;
  return {
    imagePath: projectRunPath(
      projectRoot,
      plan.runId,
      "diagnostics",
      "local-visuals",
      `${fileName}.png`,
    ),
    evidencePath: projectRunPath(
      projectRoot,
      plan.runId,
      "diagnostics",
      "local-visuals",
      `${fileName}.json`,
    ),
  };
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicSeed(seedBase: number, sceneIndex: number, revision: number): number {
  const maximum = 2_147_483_647;
  return (seedBase + sceneIndex * 10_000 + revision) % maximum;
}

async function createGenerationJob(runtimePath: string, plan: LocalVisualLaunchPlan) {
  const jobsPath = path.join(runtimePath, "jobs");
  await mkdir(jobsPath, { recursive: true });
  const root = await mkdtemp(path.join(jobsPath, "generation-"));
  const promptPath = path.join(root, "prompt.txt");
  const outputPath = path.join(root, "output.png");
  await writeFile(promptPath, plan.visualPrompt, { encoding: "utf8", flag: "wx" });
  return { outputPath, promptPath, root };
}

async function withGenerationLock<T>(runtimePath: string, task: () => Promise<T>): Promise<T> {
  await mkdir(runtimePath, { recursive: true });
  const lockPath = path.join(runtimePath, "generation.lock");
  const token = randomUUID();
  await acquireGenerationLock(lockPath, token);
  try {
    return await task();
  } finally {
    await releaseOwnedGenerationLock(lockPath, token);
  }
}

async function acquireGenerationLock(lockPath: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let createdLock = false;
    try {
      handle = await open(lockPath, "wx", 0o600);
      createdLock = true;
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, token })}\n`, "utf8");
      await handle.close();
      return;
    } catch (error) {
      await handle?.close().catch(() => undefined);
      if (createdLock) await rm(lockPath, { force: true }).catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt === 0 && (await reclaimAbandonedGenerationLock(lockPath))) continue;
      throw new SafeExitError(
        "Another local visual generation is already running; wait for it to finish.",
      );
    }
  }
}

async function reclaimAbandonedGenerationLock(lockPath: string): Promise<boolean> {
  try {
    const owner = JSON.parse(await readFile(lockPath, "utf8")) as { pid?: number };
    if (isProcessAlive(owner.pid)) return false;
    await rm(lockPath, { force: true });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    if (error instanceof SyntaxError) {
      await rm(lockPath, { force: true });
      return true;
    }
    throw error;
  }
}

function isProcessAlive(pid: number | undefined): boolean {
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function releaseOwnedGenerationLock(lockPath: string, token: string): Promise<void> {
  try {
    const owner = JSON.parse(await readFile(lockPath, "utf8")) as { token?: string };
    if (owner.token === token) await rm(lockPath, { force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
