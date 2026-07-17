import type { ProviderRequestEvidence } from "../../../costs/providerRequestEvidence.js";
import type {
  ReservedProviderCallContext,
  ReservedProviderOutcome,
} from "../../../costs/reservedProviderExecution.js";
import type { HostedVisualGenerationPlan } from "../visualGenerationPlanContracts.js";
import {
  blackForestLabsFlux2ProEndpoint,
  blackForestLabsPollResponseSchema,
  blackForestLabsSubmitResponseSchema,
  type BlackForestLabsFlux2ProResult,
} from "./blackForestLabsFlux2ProContracts.js";
import {
  blackForestLabsProviderEvidence,
  blackForestLabsUnknownOutcome,
} from "./blackForestLabsFlux2ProEvidence.js";
import {
  isTrustedBflPollingUrl,
  readBlackForestLabsJsonResponse,
  type FetchLike,
  type WaitForPoll,
} from "./blackForestLabsFlux2ProHttp.js";
import { materializeBlackForestLabsReadyScene } from "./blackForestLabsFlux2ProResult.js";

type Scene = HostedVisualGenerationPlan["scenes"][number];

export type PreparedBlackForestLabsExecution = Readonly<{
  apiKey: string;
  plan: HostedVisualGenerationPlan;
  scene: Scene;
}>;

export type SubmittedBlackForestLabsRequest = Readonly<{
  kind: "submitted";
  providerRequestId: string;
  pollingUrl: string;
  submittedCost?: number;
  requestEvidence: ProviderRequestEvidence;
}>;

type SubmitOutcome =
  SubmittedBlackForestLabsRequest | ReservedProviderOutcome<BlackForestLabsFlux2ProResult>;

/** Runs the submit, poll, and result-materialization phases for one validated scene. */
export async function executePreparedBlackForestLabsScene(input: {
  prepared: PreparedBlackForestLabsExecution;
  context: ReservedProviderCallContext;
  fetchProvider: FetchLike;
  waitForPoll: WaitForPoll;
}): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProResult>> {
  let providerRequestId: string | undefined;
  let requestEvidence: ProviderRequestEvidence | undefined;
  try {
    const submit = await submitScene(input.prepared, input.context, input.fetchProvider);
    if (submit.kind !== "submitted") return submit;
    providerRequestId = submit.providerRequestId;
    requestEvidence = submit.requestEvidence;
    return await pollSubmittedScene(
      input.prepared,
      submit,
      input.context,
      input.fetchProvider,
      input.waitForPoll,
    );
  } catch {
    return blackForestLabsUnknownOutcome(
      input.context.signal.aborted ? "timeout" : "transport",
      providerRequestId,
      requestEvidence,
    );
  }
}

async function submitScene(
  prepared: PreparedBlackForestLabsExecution,
  context: ReservedProviderCallContext,
  fetchProvider: FetchLike,
): Promise<SubmitOutcome> {
  const response = await fetchProvider(blackForestLabsFlux2ProEndpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-key": prepared.apiKey,
    },
    body: JSON.stringify({
      prompt: prepared.scene.prompt,
      seed: prepared.scene.seed,
      width: prepared.plan.settings.width,
      height: prepared.plan.settings.height,
      safety_tolerance: prepared.plan.settings.safetyTolerance,
      output_format: prepared.plan.settings.outputFormat,
    }),
    signal: context.signal,
  });
  if (!response.ok) return { kind: "unknown", reason: "provider-error" };
  const parsed = blackForestLabsSubmitResponseSchema.safeParse(
    await readBlackForestLabsJsonResponse(response),
  );
  if (!parsed.success) {
    return { kind: "unknown", reason: "indeterminate" };
  }
  const requestEvidence = [
    blackForestLabsProviderEvidence(prepared.scene, parsed.data.id, parsed.data.cost),
  ];
  if (!isTrustedBflPollingUrl(parsed.data.polling_url)) {
    return blackForestLabsUnknownOutcome("indeterminate", parsed.data.id, requestEvidence);
  }
  return {
    kind: "submitted",
    providerRequestId: parsed.data.id,
    pollingUrl: parsed.data.polling_url,
    submittedCost: parsed.data.cost,
    requestEvidence,
  };
}

async function pollSubmittedScene(
  prepared: PreparedBlackForestLabsExecution,
  submitted: SubmittedBlackForestLabsRequest,
  context: ReservedProviderCallContext,
  fetchProvider: FetchLike,
  waitForPoll: WaitForPoll,
): Promise<ReservedProviderOutcome<BlackForestLabsFlux2ProResult>> {
  for (let attempt = 0; attempt < prepared.plan.settings.maxPollAttempts; attempt += 1) {
    await waitForPoll(prepared.plan.settings.pollIntervalMs, context.signal);
    const response = await fetchProvider(submitted.pollingUrl, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: context.signal,
    });
    if (!response.ok) return unknownSubmittedOutcome("provider-error", submitted);
    const poll = blackForestLabsPollResponseSchema.safeParse(
      await readBlackForestLabsJsonResponse(response),
    );
    if (
      !poll.success ||
      (poll.data.id !== undefined && poll.data.id !== submitted.providerRequestId)
    ) {
      return unknownSubmittedOutcome("indeterminate", submitted);
    }
    if (poll.data.status === "Pending") continue;
    if (poll.data.status !== "Ready") return unknownSubmittedOutcome("provider-error", submitted);
    return materializeBlackForestLabsReadyScene(
      prepared,
      submitted,
      poll.data.cost,
      poll.data.result?.sample,
      context,
      fetchProvider,
    );
  }
  return unknownSubmittedOutcome("timeout", submitted);
}

function unknownSubmittedOutcome(
  reason: "provider-error" | "indeterminate" | "timeout",
  submitted: SubmittedBlackForestLabsRequest,
): ReservedProviderOutcome<BlackForestLabsFlux2ProResult> {
  return blackForestLabsUnknownOutcome(
    reason,
    submitted.providerRequestId,
    submitted.requestEvidence,
  );
}
