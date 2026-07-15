import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { artifactPath } from "../../core/artifacts.js";
import { SafeExitError } from "../../core/errors.js";
import { writeBinaryFile, writeTextFile } from "../../utils/fs.js";
import { sha256 } from "../../utils/hash.js";
import { readJsonFile, writeJsonFile } from "../../utils/json.js";
import { nowIso } from "../../utils/time.js";
import type { BlackForestLabsFlux2ProBatchResult } from "./providers/blackForestLabsFlux2ProBatch.js";
import { canonicalVisualGenerationDigest } from "./visualGenerationDigest.js";
import { createHostedVisualGenerationOperationId } from "./visualGenerationOperation.js";
import type { HostedVisualGenerationPlan } from "./visualGenerationPlanContracts.js";
import {
  hostedVisualGenerationSpoolReferenceSchema,
  hostedVisualGenerationSpoolSchema,
  hostedVisualOperationIdSchema,
  type HostedVisualGenerationSpoolReference,
  type LoadedHostedVisualGenerationSpool,
} from "./visualGenerationSpoolContracts.js";

export type { LoadedHostedVisualGenerationSpool } from "./visualGenerationSpoolContracts.js";

/** Persists a fully successful hosted visual batch before reservation settlement. */
export async function persistHostedVisualGenerationSpool(input: {
  runId: string;
  operationId: string;
  plan: HostedVisualGenerationPlan;
  planDigest: string;
  approvedQuote: { approvalId: string; quoteDigest: string };
  reservationId: string;
  actualUsdMicros: number;
  providerRequestId: string;
  result: BlackForestLabsFlux2ProBatchResult;
}): Promise<LoadedHostedVisualGenerationSpool> {
  const operationId = hostedVisualOperationIdSchema.parse(input.operationId);
  if (input.plan.runId !== input.runId) {
    throw new SafeExitError("Hosted visual spool plan belongs to another run.");
  }
  const expectedOperationId = createHostedVisualGenerationOperationId({
    runId: input.runId,
    planDigest: input.planDigest,
    quoteDigest: input.approvedQuote.quoteDigest,
    approvalId: input.approvedQuote.approvalId,
  });
  if (operationId !== expectedOperationId) {
    throw new SafeExitError("Hosted visual spool operation binding is invalid.");
  }
  assertBatchMatchesPlan(input);
  const directory = `operations/image-generation/${operationId}`;
  const planPath = `${directory}/plan.json`;
  const planText = `${JSON.stringify(input.plan, null, 2)}\n`;
  if (sha256(planText) !== input.planDigest) {
    throw new SafeExitError("Hosted visual spool plan bytes do not match the approved artifact.");
  }
  const images = input.result.images.map((image, index) => {
    const scene = input.plan.scenes[index];
    if (!scene) throw new SafeExitError("Hosted visual spool scene plan is incomplete.");
    const path = `${directory}/scene_${String(image.sceneIndex).padStart(3, "0")}.${image.result.extension}`;
    return {
      sceneIndex: image.sceneIndex,
      promptDigest: image.promptDigest,
      seed: image.seed,
      asset: { path, sha256: image.result.digest, bytes: image.result.buffer.byteLength },
      media: image.result.media,
      billing: image.result.providerBilling,
      providerRequest: input.result.providerRequests[index],
      buffer: image.result.buffer,
    };
  });
  for (const image of images) {
    await writeBinaryFile(artifactPath(input.runId, image.asset.path), image.buffer);
  }
  await writeTextFile(artifactPath(input.runId, planPath), planText);
  const spoolInput = {
    schemaVersion: 1 as const,
    runId: input.runId,
    operationId,
    plan: {
      sourcePath: "production/visuals/generation_plan.json" as const,
      path: planPath,
      digest: input.planDigest,
      bindingDigest: input.plan.bindingDigest,
    },
    approvedQuote: input.approvedQuote,
    reservationId: input.reservationId,
    provider: { service: "black-forest-labs" as const, modelId: "flux-2-pro" as const },
    actualUsdMicros: input.actualUsdMicros,
    providerRequestIdHash: sha256(input.providerRequestId),
    images: images.map(({ buffer: _buffer, ...image }) => image),
    createdAt: nowIso(),
  };
  const spool = hostedVisualGenerationSpoolSchema.parse({
    ...spoolInput,
    spoolDigest: canonicalVisualGenerationDigest(spoolInput),
  });
  const path = `${directory}/result.json`;
  await writeJsonFile(artifactPath(input.runId, path), spool);
  return loadHostedVisualGenerationSpool(input.runId, {
    operationId,
    path,
    digest: spool.spoolDigest,
  });
}

/** Loads a committed hosted image spool and verifies every referenced image byte. */
export async function loadHostedVisualGenerationSpool(
  runId: string,
  rawReference: HostedVisualGenerationSpoolReference,
): Promise<LoadedHostedVisualGenerationSpool> {
  const reference = hostedVisualGenerationSpoolReferenceSchema.parse(rawReference);
  const expectedPath = `operations/image-generation/${reference.operationId}/result.json`;
  if (reference.path !== expectedPath) {
    throw new SafeExitError("Hosted visual spool path does not match its operation id.");
  }
  const spool = hostedVisualGenerationSpoolSchema.parse(
    await readJsonFile<unknown>(artifactPath(runId, reference.path)),
  );
  const { spoolDigest, ...digestInput } = spool;
  if (
    spool.runId !== runId ||
    spool.operationId !== reference.operationId ||
    spoolDigest !== reference.digest ||
    canonicalVisualGenerationDigest(digestInput) !== spoolDigest
  ) {
    throw new SafeExitError("Hosted visual spool digest or identity is invalid.");
  }
  const planBytes = await readFile(artifactPath(runId, spool.plan.path));
  if (createHash("sha256").update(planBytes).digest("hex") !== spool.plan.digest) {
    throw new SafeExitError("Hosted visual spool plan snapshot is invalid.");
  }
  const images = await Promise.all(
    spool.images.map(async (image) => {
      const buffer = await readFile(artifactPath(runId, image.asset.path));
      if (
        buffer.byteLength !== image.asset.bytes ||
        createHash("sha256").update(buffer).digest("hex") !== image.asset.sha256
      ) {
        throw new SafeExitError(`Hosted visual spool image is invalid: ${image.asset.path}.`);
      }
      return {
        sceneIndex: image.sceneIndex,
        buffer,
        extension: image.asset.path.endsWith(".png") ? ("png" as const) : ("jpg" as const),
      };
    }),
  );
  return { reference, spool, images };
}

/** Resolves a committed spool from its deterministic operation directory. */
export async function loadHostedVisualGenerationSpoolForOperation(
  runId: string,
  rawOperationId: string,
  expectedDigest: string,
): Promise<LoadedHostedVisualGenerationSpool> {
  const operationId = hostedVisualOperationIdSchema.parse(rawOperationId);
  const path = `operations/image-generation/${operationId}/result.json`;
  return loadHostedVisualGenerationSpool(runId, { operationId, path, digest: expectedDigest });
}

function assertBatchMatchesPlan(input: {
  plan: HostedVisualGenerationPlan;
  planDigest: string;
  actualUsdMicros: number;
  result: BlackForestLabsFlux2ProBatchResult;
}): void {
  if (input.result.images.length !== input.plan.scenes.length) {
    throw new SafeExitError("Hosted visual spool image count does not match the approved plan.");
  }
  if (input.result.providerRequests.length !== input.result.images.length) {
    throw new SafeExitError("Hosted visual spool request evidence is incomplete.");
  }
  const actualSum = input.result.images.reduce(
    (sum, image) => sum + image.result.providerBilling.derivedUsdMicros,
    0,
  );
  if (actualSum !== input.actualUsdMicros) {
    throw new SafeExitError("Hosted visual spool billing does not match provider execution.");
  }
  input.result.images.forEach((image, index) => {
    const scene = input.plan.scenes[index];
    const request = input.result.providerRequests[index];
    if (
      !scene ||
      !request ||
      image.sceneIndex !== scene.sceneIndex ||
      image.promptDigest !== scene.promptDigest ||
      image.seed !== scene.seed ||
      image.result.digest !== createHash("sha256").update(image.result.buffer).digest("hex") ||
      image.result.media.bytes !== image.result.buffer.byteLength ||
      image.result.provider.service !== "black-forest-labs" ||
      image.result.provider.modelId !== "flux-2-pro" ||
      image.result.provider.outputFormat !== image.result.media.format ||
      request.requestIndex !== index ||
      request.inputDigest !== image.result.providerRequest.inputDigest ||
      request.requestIdHash !== image.result.providerRequest.requestIdHash ||
      request.reportedUnits !== image.result.providerBilling.billableCredits
    ) {
      throw new SafeExitError("Hosted visual spool result does not match the approved scene plan.");
    }
  });
  if (!/^[a-f0-9]{64}$/.test(input.planDigest)) {
    throw new SafeExitError("Hosted visual spool requires the exact plan artifact digest.");
  }
}
