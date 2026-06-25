import type { AnalyticsRecord } from "./schema.js";

type Recommendation = {
  reasons: string[];
  record: AnalyticsRecord;
};

export type AnalyticsRecordConfidence = {
  details: string;
  level: "high" | "low" | "medium";
};

export function renderAnalyticsRecommendations(records: AnalyticsRecord[]): string[] {
  const repeatCandidates = records.map(repeatRecommendation).filter(isRecommendation);
  const avoidCandidates = records.map(avoidRecommendation).filter(isRecommendation);
  return [
    "### Repeat candidates",
    "",
    ...recommendationLines(repeatCandidates, "No repeat candidate yet."),
    "",
    "### Avoid without revision",
    "",
    ...recommendationLines(avoidCandidates, "No avoid candidate yet."),
    "",
    "### Test next",
    "",
    "- Compare title promise, thumbnail direction, and first-minute hook before changing the production format.",
    "- Keep the next experiment small: one topic/title/thumbnail hypothesis, one observation window, one decision rule.",
    "- Link future imports to `run_id` whenever possible so CLI and Studio can show run-level context.",
    "",
    "### Evidence limits",
    "",
    "- Treat these as operator planning prompts, not proof that one variable caused the result.",
    "- Missing impressions, retention, or run links reduce confidence; prefer better imports before large format changes.",
  ];
}

function repeatRecommendation(record: AnalyticsRecord): Recommendation | null {
  const reasons = [
    record.ctr !== undefined && record.ctr >= 0.06 ? "strong CTR" : null,
    record.averagePercentageViewed !== undefined && record.averagePercentageViewed >= 0.35
      ? "strong retention"
      : null,
    record.subscribersGained !== undefined && record.subscribersGained > 0
      ? "subscriber gain"
      : null,
  ].filter(isString);
  return reasons.length > 0 ? { reasons, record } : null;
}

function avoidRecommendation(record: AnalyticsRecord): Recommendation | null {
  const reasons = [
    record.ctr !== undefined && record.ctr < 0.025 ? "weak CTR" : null,
    record.averagePercentageViewed !== undefined && record.averagePercentageViewed < 0.25
      ? "weak retention"
      : null,
  ].filter(isString);
  return reasons.length > 0 ? { reasons, record } : null;
}

function recommendationLines(recommendations: Recommendation[], emptyText: string): string[] {
  if (recommendations.length === 0) {
    return [`- ${emptyText}`];
  }
  return recommendations.map(({ reasons, record }) => {
    const confidence = analyticsRecordConfidence(record);
    return `- ${inlineText(record.title ?? record.videoId)} (${record.runId ?? "unmapped"}): ${reasons.join(", ")} (confidence: ${confidence.level}; ${confidence.details}).`;
  });
}

export function analyticsRecordConfidence(record: AnalyticsRecord): AnalyticsRecordConfidence {
  const missing = [
    record.runId ? null : "run link",
    record.views !== undefined ? null : "views",
    record.impressions !== undefined ? null : "impressions",
    record.ctr !== undefined ? null : "CTR",
    record.averagePercentageViewed !== undefined ? null : "retention",
  ].filter(isString);
  const presentCount = 5 - missing.length;
  return {
    details:
      missing.length === 0
        ? "run-linked with views, impressions, CTR, and retention"
        : `missing ${missing.join(", ")}`,
    level: confidenceLevel(presentCount),
  };
}

function confidenceLevel(presentCount: number): AnalyticsRecordConfidence["level"] {
  if (presentCount >= 5) {
    return "high";
  }
  if (presentCount >= 3) {
    return "medium";
  }
  return "low";
}

function isRecommendation(value: Recommendation | null): value is Recommendation {
  return value !== null;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function inlineText(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ").trim();
}
