import { z } from "zod";
import type { FinalReviewBundle } from "./finalReviewBundleContracts.js";
import { digestSchema } from "./renderPlanSchemas.js";

export const channelHandoffJsonPath = "production/channel_handoff.json";
export const channelHandoffMarkdownPath = "production/channel_handoff.md";

export function channelHandoffCommand(runId: string): string {
  return `pnpm producer channel-handoff --run ${runId}`;
}

const legacyChannelHandoffSchema = z.looseObject({ schemaVersion: z.literal(1) });

export const channelHandoffSchema = z.strictObject({
  schemaVersion: z.literal(2),
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
    chaptersPath: z.string().min(1),
    chaptersJsonPath: z.string().min(1),
  }),
  youtube: z.strictObject({
    metadataPath: z.literal("production/youtube_metadata.json"),
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)),
  }),
  thumbnailCandidates: z.strictObject({
    jsonPath: z.literal("production/thumbnail_candidates.json"),
    markdownPath: z.literal("production/thumbnail_candidates.md"),
    jsonSha256: digestSchema,
    markdownSha256: digestSchema,
    recommendedCandidateId: z.string().min(1),
  }),
  operatorChecklist: z.array(z.string().min(1)).min(1),
  blockedActions: z.array(z.string().min(1)).min(1),
  nextSafeAction: z.string().min(1),
});

export type ChannelHandoff = z.infer<typeof channelHandoffSchema>;

export const youtubeMetadataSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)),
});

export type YoutubeMetadataDraft = z.infer<typeof youtubeMetadataSchema>;

export function buildChannelHandoffPayload(input: {
  finalReviewBundle: FinalReviewBundle;
  finalReviewBundleDigest: string;
  runId: string;
  thumbnailCandidates: ChannelHandoff["thumbnailCandidates"];
  youtube: YoutubeMetadataDraft;
}): Omit<ChannelHandoff, "createdAt"> {
  return {
    schemaVersion: 2,
    runId: input.runId,
    status: "ready-for-manual-channel-review",
    manualOnly: true,
    finalReviewBundle: {
      path: "production/review_bundle.json",
      markdownPath: "production/review_bundle.md",
      digest: input.finalReviewBundleDigest,
      status: "accepted-for-local-review",
    },
    media: {
      draftRenderPath: input.finalReviewBundle.draftRender.path,
      draftRenderSha256: input.finalReviewBundle.draftRender.sha256,
      durationSeconds: input.finalReviewBundle.draftRender.durationSeconds,
      subtitlesPath: "production/subtitles.srt",
      renderReviewPath: input.finalReviewBundle.draftRender.reviewPath,
      chaptersPath: input.finalReviewBundle.draftRender.chapters.markdownPath,
      chaptersJsonPath: input.finalReviewBundle.draftRender.chapters.jsonPath,
    },
    youtube: {
      metadataPath: "production/youtube_metadata.json",
      title: input.youtube.title,
      description: input.youtube.description,
      tags: input.youtube.tags,
    },
    thumbnailCandidates: input.thumbnailCandidates,
    operatorChecklist: channelHandoffOperatorChecklist(),
    blockedActions: channelHandoffBlockedActions(input.finalReviewBundle.blockedActions),
    nextSafeAction: channelHandoffNextSafeAction,
  };
}

export function isLegacyChannelHandoff(value: unknown): boolean {
  return legacyChannelHandoffSchema.safeParse(value).success;
}

export function comparableChannelHandoffPayload(
  handoff: ChannelHandoff,
): Omit<ChannelHandoff, "createdAt"> {
  const { createdAt: _createdAt, ...payload } = handoff;
  return payload;
}

export const channelHandoffNextSafeAction =
  "Manually review production/channel_handoff.md, the MP4, subtitles, metadata, and thumbnail assets before any future private-upload approval path is used.";

export function channelHandoffOperatorChecklist(): string[] {
  return [
    "Watch the draft MP4 from start to finish outside the app.",
    "Verify subtitles, voiceover timing, popup cards, and visual rhythm against the final review bundle.",
    "Review and revise the YouTube chapter draft before copying it into any future upload workflow.",
    "Review the YouTube title, description, and tags for channel tone, accuracy, and policy risk.",
    "Choose or revise one tracked thumbnail candidate before any upload workflow.",
    "Keep upload and public/scheduled publish disabled unless a future explicit approval/config path exists.",
  ];
}

export function channelHandoffBlockedActions(
  finalReviewBlockedActions: readonly string[],
): string[] {
  return Array.from(
    new Set([
      ...finalReviewBlockedActions,
      "This handoff does not call YouTube APIs or create a private upload.",
      "This handoff does not approve public or scheduled publishing.",
    ]),
  );
}
