import { z } from "zod";

export const channelHandoffJsonPath = "production/channel_handoff.json";
export const channelHandoffMarkdownPath = "production/channel_handoff.md";

export function channelHandoffCommand(runId: string): string {
  return `pnpm producer channel-handoff --run ${runId}`;
}

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const channelHandoffSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.iso.datetime(),
  status: z.literal("ready-for-manual-channel-review"),
  manualOnly: z.literal(true),
  finalReviewBundle: z.strictObject({
    path: z.literal("production/review_bundle.json"),
    markdownPath: z.literal("production/review_bundle.md"),
    digest: digestSchema,
    status: z.literal("accepted-for-local-review"),
  }),
  media: z.strictObject({
    draftRenderPath: z.string().min(1),
    draftRenderSha256: digestSchema,
    durationSeconds: z.number().positive(),
    subtitlesPath: z.literal("production/subtitles.srt"),
    renderReviewPath: z.string().min(1),
  }),
  youtube: z.strictObject({
    metadataPath: z.literal("production/youtube_metadata.json"),
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)),
  }),
  operatorChecklist: z.array(z.string().min(1)).min(1),
  blockedActions: z.array(z.string().min(1)).min(1),
  nextSafeAction: z.string().min(1),
});

export type ChannelHandoff = z.infer<typeof channelHandoffSchema>;
