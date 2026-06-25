import { analyticsRecordSchema, type AnalyticsRecord } from "./schema.js";

const FIELD_ALIASES: Record<string, keyof AnalyticsRecord> = {
  average_percentage_viewed: "averagePercentageViewed",
  averagePercentageViewed: "averagePercentageViewed",
  average_view_duration_seconds: "averageViewDurationSeconds",
  averageViewDurationSeconds: "averageViewDurationSeconds",
  avg_percentage_viewed: "averagePercentageViewed",
  avg_view_duration_seconds: "averageViewDurationSeconds",
  comments: "comments",
  ctr: "ctr",
  ctr_percent: "ctr",
  ctrPercent: "ctr",
  impressions: "impressions",
  likes: "likes",
  notes: "notes",
  published_at: "publishedAt",
  publishedAt: "publishedAt",
  run_id: "runId",
  runId: "runId",
  subscribers_gained: "subscribersGained",
  subscribersGained: "subscribersGained",
  title: "title",
  video_id: "videoId",
  videoId: "videoId",
  views: "views",
};

const INTEGER_FIELDS = new Set<keyof AnalyticsRecord>([
  "comments",
  "impressions",
  "likes",
  "subscribersGained",
  "views",
]);

const NUMBER_FIELDS = new Set<keyof AnalyticsRecord>(["averageViewDurationSeconds"]);
const RATE_FIELDS = new Set<keyof AnalyticsRecord>(["averagePercentageViewed", "ctr"]);

export function normalizeAnalyticsRecord(input: unknown): AnalyticsRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return analyticsRecordSchema.parse(input);
  }
  const normalized: Partial<Record<keyof AnalyticsRecord, unknown>> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = FIELD_ALIASES[rawKey];
    if (!key) {
      continue;
    }
    if (INTEGER_FIELDS.has(key)) {
      normalized[key] = parseInteger(rawValue);
    } else if (NUMBER_FIELDS.has(key)) {
      normalized[key] = parseNumber(rawValue);
    } else if (RATE_FIELDS.has(key)) {
      normalized[key] = parseRate(rawValue);
    } else {
      const text = normalizeScalarText(rawValue);
      if (text) {
        normalized[key] = text;
      }
    }
  }
  return analyticsRecordSchema.parse(dropUndefined(normalized));
}

function parseInteger(value: unknown): number | undefined {
  const parsed = parseNumber(value);
  if (parsed === undefined) {
    return undefined;
  }
  return Math.trunc(parsed);
}

function parseNumber(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  const normalized = normalizeNumericInput(value);
  if (normalized === undefined) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeNumericInput(value: unknown): string | number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.replaceAll(",", "").trim();
  }
  return undefined;
}

function parseRate(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  const text = normalizeScalarText(value);
  if (!text) {
    return undefined;
  }
  const percentage = text.endsWith("%");
  const parsed = parseNumber(percentage ? text.slice(0, -1) : text);
  if (parsed === undefined) {
    return undefined;
  }
  return percentage || parsed > 1 ? parsed / 100 : parsed;
}

function normalizeScalarText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString().trim();
  }
  return undefined;
}

function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  ) as T;
}
