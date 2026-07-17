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

export function submitResponse(
  pollingUrl = "https://api.bfl.ai/v1/get_result?id=task-123",
  cost: number | undefined = 9,
) {
  return { id: "task-123", polling_url: pollingUrl, ...(cost === undefined ? {} : { cost }) };
}

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

export function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export function imageResponse(body: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

export async function image(
  format: "jpeg" | "png",
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 8, g: 16, b: 32 } } })
    [format]()
    .toBuffer();
}

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
