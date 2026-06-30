import { z } from "zod";

const renderDecisionContractValues = [
  "accepted-for-local-review",
  "needs-revision",
  "rejected",
] as const;

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const renderDecisionInputSchema = z.strictObject({
  decision: z.enum(renderDecisionContractValues),
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: z.string().min(1),
});

export type RenderDecisionInput = z.input<typeof renderDecisionInputSchema>;

export const renderDecisionRecordSchema = z.strictObject({
  blockedActions: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  decision: z.enum(renderDecisionContractValues),
  draftRender: z.strictObject({
    durationSeconds: z.number().positive(),
    path: z.string().min(1),
    reviewCommand: z.string().min(1),
    sha256: digestSchema,
  }),
  nextSafeAction: z.string().min(1),
  notes: z.string().min(1),
  renderApproval: z.strictObject({
    approvalId: z.string().min(1),
    approvedRef: digestSchema,
  }),
  reviewedBy: z.string().min(1),
  runId: z.string().min(1),
  schemaVersion: z.literal(1),
  voiceover: z.strictObject({
    mode: z.string().min(1),
    productionVoiceCandidate: z.boolean(),
    quality: z.string().min(1),
  }),
});

export type RenderDecisionRecord = z.infer<typeof renderDecisionRecordSchema>;
