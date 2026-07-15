import { z } from "zod";
import { isValidRunId, RUN_ID_ERROR_MESSAGE } from "../../core/runId.js";
import { providerRequestEvidenceItemSchema } from "../../costs/providerRequestEvidence.js";
import { digestSchema } from "../render/renderPlanSchemas.js";
import { hostedVisualGenerationPlanPath } from "./visualGenerationPlanContracts.js";

export const hostedVisualOperationIdSchema = z.string().regex(/^image_[a-f0-9]{64}$/);

const operationDirectoryPattern = "operations/image-generation/image_[a-f0-9]{64}";

export const hostedVisualGenerationSpoolReferenceSchema = z.strictObject({
  operationId: hostedVisualOperationIdSchema,
  path: z.string().regex(new RegExp(`^${operationDirectoryPattern}/result\\.json$`)),
  digest: digestSchema,
});

const hostedVisualBillingSchema = z.strictObject({
  source: z.literal("provider-reported-credits-approved-tariff-derived-usd"),
  billableCredits: z.number().nonnegative(),
  usdPerCredit: z.literal(0.01),
  derivedUsdMicros: z.int().nonnegative(),
});

const hostedVisualMediaSchema = z.strictObject({
  bytes: z.int().positive(),
  format: z.enum(["jpeg", "png"]),
  height: z.int().positive(),
  width: z.int().positive(),
});

export const hostedVisualGenerationSpoolSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().refine(isValidRunId, { message: RUN_ID_ERROR_MESSAGE }),
  operationId: hostedVisualOperationIdSchema,
  plan: z.strictObject({
    sourcePath: z.literal(hostedVisualGenerationPlanPath),
    path: z.string().regex(new RegExp(`^${operationDirectoryPattern}/plan\\.json$`)),
    digest: digestSchema,
    bindingDigest: digestSchema,
  }),
  approvedQuote: z.strictObject({
    approvalId: z.string().min(1).max(200),
    quoteDigest: digestSchema,
  }),
  reservationId: z.string().min(1).max(200),
  provider: z.strictObject({
    service: z.literal("black-forest-labs"),
    modelId: z.literal("flux-2-pro"),
  }),
  actualUsdMicros: z.int().nonnegative(),
  providerRequestIdHash: digestSchema,
  images: z
    .array(
      z.strictObject({
        sceneIndex: z.int().positive(),
        promptDigest: digestSchema,
        seed: z.int().nonnegative().max(4_294_967_295),
        asset: z.strictObject({
          path: z
            .string()
            .regex(new RegExp(`^${operationDirectoryPattern}/scene_\\d{3}\\.(jpg|png)$`)),
          sha256: digestSchema,
          bytes: z.int().positive(),
        }),
        media: hostedVisualMediaSchema,
        billing: hostedVisualBillingSchema,
        providerRequest: providerRequestEvidenceItemSchema,
      }),
    )
    .min(1)
    .max(24),
  createdAt: z.iso.datetime(),
  spoolDigest: digestSchema,
});

export type HostedVisualGenerationSpool = z.infer<typeof hostedVisualGenerationSpoolSchema>;
export type HostedVisualGenerationSpoolReference = z.infer<
  typeof hostedVisualGenerationSpoolReferenceSchema
>;
export type LoadedHostedVisualGenerationSpool = Readonly<{
  reference: HostedVisualGenerationSpoolReference;
  spool: HostedVisualGenerationSpool;
  images: ReadonlyArray<{ sceneIndex: number; buffer: Buffer; extension: "jpg" | "png" }>;
}>;
