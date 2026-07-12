import { z } from "zod";
import { digestSchema } from "../render/renderPlanSchemas.js";

export const channelHandoffDecisionValues = [
  "accepted-for-manual-channel-prep",
  "needs-revision",
  "rejected",
] as const;

export type ChannelHandoffDecision = (typeof channelHandoffDecisionValues)[number];

export const channelHandoffDecisionJsonPath = "production/channel_handoff_decision.json";
export const channelHandoffDecisionMarkdownPath = "production/channel_handoff_decision.md";

export const channelHandoffDecisionInputSchema = z.strictObject({
  decision: z.enum(channelHandoffDecisionValues),
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: z.string().min(1),
  thumbnailCandidateId: z.string().trim().min(1).max(120).optional(),
});

export type ChannelHandoffDecisionInput = z.input<typeof channelHandoffDecisionInputSchema>;

export const selectedThumbnailCandidateSchema = z.strictObject({
  candidateId: z.string().min(1),
  templatePath: z.string().min(1),
  templateSha256: digestSchema,
  textSafeOverlayPath: z.string().min(1).optional(),
  textSafeOverlaySha256: digestSchema.optional(),
});

export type SelectedThumbnailCandidate = z.infer<typeof selectedThumbnailCandidateSchema>;

export const channelHandoffDecisionRecordSchema = z.strictObject({
  blockedActions: z.array(z.string().min(1)).min(1),
  channelHandoff: z.strictObject({
    digest: digestSchema,
    path: z.literal("production/channel_handoff.json"),
    status: z.literal("ready-for-manual-channel-review"),
  }),
  createdAt: z.iso.datetime(),
  decision: z.enum(channelHandoffDecisionValues),
  manualOnly: z.literal(true),
  nextSafeAction: z.string().min(1),
  notes: z.string().min(1),
  reviewedBy: z.string().min(1),
  runId: z.string().min(1),
  schemaVersion: z.literal(1),
  selectedThumbnailCandidate: selectedThumbnailCandidateSchema.nullable(),
  youtube: z.strictObject({
    metadataPath: z.literal("production/youtube_metadata.json"),
    title: z.string().min(1),
  }),
});

export type ChannelHandoffDecisionRecord = z.infer<typeof channelHandoffDecisionRecordSchema>;

export function channelHandoffDecisionCommand(runId: string): string {
  return `pnpm producer decide channel-handoff --run ${runId} --decision accepted-for-manual-channel-prep --thumbnail-candidate <candidate_id> --notes '<operator notes>' --reviewed-by operator`;
}
