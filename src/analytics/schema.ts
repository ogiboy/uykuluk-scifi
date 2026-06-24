import { z } from "zod";

export const analyticsRecordSchema = z.strictObject({
  averagePercentageViewed: z.number().min(0).max(1).optional(),
  averageViewDurationSeconds: z.number().min(0).optional(),
  comments: z.int().min(0).optional(),
  ctr: z.number().min(0).max(1).optional(),
  impressions: z.int().min(0).optional(),
  likes: z.int().min(0).optional(),
  notes: z.string().min(1).optional(),
  publishedAt: z.string().min(1).optional(),
  runId: z
    .string()
    .regex(/^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/)
    .optional(),
  subscribersGained: z.int().optional(),
  title: z.string().min(1).optional(),
  videoId: z.string().min(1),
  views: z.int().min(0).optional(),
});

export const analyticsDatasetSchema = z.strictObject({
  generatedAt: z.iso.datetime(),
  records: z.array(analyticsRecordSchema),
  schemaVersion: z.literal(1),
  source: z.strictObject({
    fileName: z.string().min(1),
    format: z.enum(["csv", "json"]),
    recordCount: z.int().min(0),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});

export type AnalyticsDataset = z.infer<typeof analyticsDatasetSchema>;
export type AnalyticsRecord = z.infer<typeof analyticsRecordSchema>;
