import { z } from "zod";
import type { VisualMedia } from "../visualContracts.js";

export const blackForestLabsProvider = "black-forest-labs" as const;
export const blackForestLabsFlux2ProModel = "flux-2-pro" as const;
export const blackForestLabsFlux2ProEndpoint = "https://api.bfl.ai/v1/flux-2-pro" as const;

const providerTaskIdSchema = z.string().trim().min(1).max(256);
const providerCreditSchema = z.number().nonnegative();

export const blackForestLabsSubmitResponseSchema = z.object({
  id: providerTaskIdSchema,
  polling_url: z.url(),
  cost: providerCreditSchema.optional(),
});

export const blackForestLabsPollResponseSchema = z.object({
  id: providerTaskIdSchema.optional(),
  status: z.enum(["Pending", "Ready", "Error", "Failed", "Request Moderated", "Content Moderated"]),
  cost: providerCreditSchema.optional(),
  result: z.object({ sample: z.url() }).optional(),
});

export type BlackForestLabsFlux2ProResult = Readonly<{
  buffer: Buffer;
  digest: string;
  extension: "jpg" | "png";
  media: VisualMedia;
  provider: Readonly<{
    service: typeof blackForestLabsProvider;
    modelId: typeof blackForestLabsFlux2ProModel;
    outputFormat: "jpeg" | "png";
  }>;
  providerBilling: Readonly<{
    source: "provider-reported-credits-approved-tariff-derived-usd";
    billableCredits: number;
    usdPerCredit: 0.01;
    derivedUsdMicros: number;
  }>;
  providerRequest: Readonly<{ inputDigest: string; requestIdHash: string }>;
}>;
