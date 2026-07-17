import { z } from "zod";
import { isValidRunId } from "../core/runId.js";
import { hostedVisualExecutionConfirmationSchema } from "../stages/visuals/hostedVisualExecutionConfirmation.js";
import { visualMutationExpectationSchema } from "../stages/visuals/visualMutationExpectation.js";

const visualRunIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });
const visualSourceFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !value.includes("/") && !value.includes("\\"), {
    message: "Visual source file name must not contain path separators.",
  })
  .refine((value) => /\.(?:jpe?g|png)$/i.test(value), {
    message: "Visual imports must use a PNG or JPEG file name.",
  });
const visualBase64Schema = z
  .string()
  .min(4)
  .max(34_952_536)
  .refine((value) => value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value), {
    message: "Visual import content must be canonical base64.",
  });
const visualExpectedActiveRevisionsSchema =
  visualMutationExpectationSchema.shape.expectedActiveRevisions.refine(
    (items) => new Set(items.map((item) => item.sceneIndex)).size === items.length,
    { message: "Expected active visual revisions must contain unique scene indexes." },
  );
const visualMutationExpectationRequestShape = {
  expectedActiveRevisions: visualExpectedActiveRevisionsSchema,
  expectedManifestDigest: visualMutationExpectationSchema.shape.expectedManifestDigest,
} as const;

export const visualImportRequestSchema = z.strictObject({
  contentBase64: visualBase64Schema,
  ...visualMutationExpectationRequestShape,
  runId: visualRunIdSchema,
  sceneIndex: z.int().positive().max(24),
  sourceFileName: visualSourceFileNameSchema,
});
export const visualDecisionRequestSchema = z.strictObject({
  ...visualMutationExpectationRequestShape,
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: visualRunIdSchema,
  sceneIndexes: z.array(z.int().positive().max(24)).min(1).max(24),
  status: z.enum(["approved", "rejected"]),
});
export const visualRegenerationRequestSchema = z.strictObject({
  ...visualMutationExpectationRequestShape,
  runId: visualRunIdSchema,
  sceneIndexes: z.array(z.int().positive().max(24)).min(1).max(24),
});
export const hostedVisualPlanRequestSchema = z
  .strictObject({
    expectedActiveRevisions: visualExpectedActiveRevisionsSchema.optional(),
    expectedManifestDigest: visualMutationExpectationSchema.shape.expectedManifestDigest.optional(),
    reason: z.string().trim().min(1).max(1_000).optional(),
    reviewedBy: z.string().trim().min(1).max(200).optional(),
    runId: visualRunIdSchema,
    purpose: z.enum(["initial", "regenerate-rejected"]),
    sceneIndexes: z.array(z.int().positive().max(24)).min(1).max(24),
  })
  .superRefine((input, context) => {
    if (input.purpose !== "regenerate-rejected") return;
    for (const [value, path, message] of [
      [
        input.expectedManifestDigest,
        "expectedManifestDigest",
        "Current visual manifest digest is required for regeneration.",
      ],
      [
        input.expectedActiveRevisions,
        "expectedActiveRevisions",
        "Current active visual revisions are required for regeneration.",
      ],
      [input.reviewedBy, "reviewedBy", "Reviewer is required for regeneration."],
      [input.reason, "reason", "Reason is required for regeneration."],
    ] as const) {
      if (!value) context.addIssue({ code: "custom", message, path: [path] });
    }
  });
export const hostedVisualGenerationRequestSchema = z.strictObject({
  executionMode: z.literal("hosted"),
  runId: visualRunIdSchema,
  ...hostedVisualExecutionConfirmationSchema.shape,
});
