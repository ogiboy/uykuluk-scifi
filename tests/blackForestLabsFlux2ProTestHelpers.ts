import sharp from "sharp";
import type { ReservedProviderCallContext } from "../src/costs/reservedProviderExecution";
import {
  createBlackForestLabsFlux2ProAdapter,
  type BlackForestLabsFlux2ProDependencies,
} from "../src/stages/visuals/providers/blackForestLabsFlux2ProExecution";
import type { HostedVisualGenerationPlan } from "../src/stages/visuals/visualGenerationPlanContracts";

const digest = "a".repeat(64);
export const bindingDigest = "b".repeat(64);
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Executes the Black Forest Labs Flux 2 Pro adapter with deterministic test dependencies.
 *
 * @param fetchMock - Fetch implementation used for provider requests
 * @param signal - Abort signal for the adapter execution
 * @returns The adapter execution result
 */
export async function executeBflAdapter(
  fetchMock: FetchLike,
  signal = new AbortController().signal,
) {
  const dependencies: BlackForestLabsFlux2ProDependencies = {
    fetch: fetchMock,
    waitForPoll: async () => undefined,
  };
  const adapter = createBlackForestLabsFlux2ProAdapter({
    plan,
    sceneIndex: 1,
    bindingDigest,
    dependencies,
  });
  return adapter.execute(context(signal));
}

/**
 * Creates a mock provider submission response.
 *
 * @param pollingUrl - The URL used to poll for the task result
 * @param cost - The optional request cost
 * @returns A submission response containing the task identifier, polling URL, and optional cost
 */
export function submitResponse(
  pollingUrl = "https://api.bfl.ai/v1/get_result?id=task-123",
  cost: number | undefined = 9,
) {
  return { id: "task-123", polling_url: pollingUrl, ...(cost === undefined ? {} : { cost }) };
}

/**
 * Creates a completed image-generation response for provider polling tests.
 *
 * @param cost - Optional provider-reported cost.
 * @param sample - Image sample URL included in the completed result.
 * @returns A response payload with a completed status, task identifier, image sample, and optional cost.
 */
export function readyResponse(
  cost: number | undefined,
  sample = "https://delivery.bfl.ai/signed/image.jpg",
) {
  return {
    id: "task-123",
    status: "Ready",
    result: { sample },
    ...(cost === undefined ? {} : { cost }),
  };
}

/**
 * Creates a successful JSON response from a value.
 *
 * @param body - The value to serialize as JSON
 * @returns An HTTP 200 response containing the serialized value
 */
export function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Creates a successful HTTP response containing image data.
 *
 * @param body - The image bytes to include in the response
 * @param contentType - The MIME type of the image
 * @returns A response containing the image data and content type
 */
export function imageResponse(body: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

/**
 * Creates a solid-color RGB image encoded in the requested format.
 *
 * @param format - The output image format.
 * @param width - The image width in pixels.
 * @param height - The image height in pixels.
 * @returns The encoded image data.
 */
export async function image(
  format: "jpeg" | "png",
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 8, g: 16, b: 32 } } })
    [format]()
    .toBuffer();
}

/**
 * Creates the fixed provider call context used by the Flux 2 Pro test helpers.
 *
 * @param signal - Abort signal associated with the provider call
 * @returns The provider call context with deterministic reservation, operation, provider, model, binding, and budget values
 */
function context(signal: AbortSignal): ReservedProviderCallContext {
  return {
    reservationId: "reservation-1",
    operationId: "image_123",
    provider: "black-forest-labs",
    model: "flux-2-pro",
    bindingDigest,
    maxUsdMicros: 90_000,
    signal,
  };
}

export const plan: HostedVisualGenerationPlan = {
  schemaVersion: 1,
  runId: "run_hosted",
  createdAt: "2026-07-15T12:00:00.000Z",
  productionPackage: { path: "production/production_package.meta.json", digest },
  visualManifest: { path: "production/visuals/manifest.json", digest },
  purpose: "initial",
  targetedSceneIndexes: [1],
  provider: "black-forest-labs",
  model: "flux-2-pro",
  settings: {
    endpoint: "https://api.bfl.ai/v1/flux-2-pro",
    width: 1920,
    height: 1080,
    outputFormat: "jpeg",
    safetyTolerance: 2,
    timeoutMs: 300_000,
    pollIntervalMs: 250,
    maxPollAttempts: 2,
  },
  pricing: {
    source: "configured-snapshot",
    snapshotId: "bfl-flux-2-pro-2026-07-15",
    usdPerMegapixel: 0.03,
    usdPerCredit: 0.01,
    estimatedUsdPerImage: 0.09,
    maximumUsdPerImage: 0.09,
    digest,
  },
  scenes: [
    {
      sceneIndex: 1,
      prompt: "A scientifically careful cinematic orbital scene without text.",
      promptDigest: digest,
      activeRevision: 1,
      activeRevisionDigest: digest,
      seed: 42,
      maximumUsd: 0.09,
    },
  ],
  totalMaximumUsd: 0.09,
  bindingDigest: digest,
};
