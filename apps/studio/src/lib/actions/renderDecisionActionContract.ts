import { z } from "zod";
import { isValidRunId } from "../../../../../src/core/runId";
import { renderDecisionValues } from "../../../../../src/stages/render/renderDecisionCommands";

const renderDecisionRequestSchema = z.strictObject({
  decision: z.enum(renderDecisionValues),
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: z.string().refine(isValidRunId, { message: "Invalid run id." }),
});

export type StudioRenderDecisionRequest = z.infer<typeof renderDecisionRequestSchema>;

/**
 * Parses the Studio render-decision action payload using the same canonical primitives as the core
 * `render.decide` service contract.
 *
 * @param payload - The request payload to validate.
 * @returns The validated render-decision request.
 */
export function parseStudioRenderDecisionRequest(payload: unknown): StudioRenderDecisionRequest {
  return renderDecisionRequestSchema.parse(payload);
}
