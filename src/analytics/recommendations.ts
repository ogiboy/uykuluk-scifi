import { analyticsRecordConfidence } from "./dataQuality.js";
import type { AnalyticsRecord } from "./schema.js";

type Recommendation = { reasons: string[]; record: AnalyticsRecord };

/**
 * Renders Markdown analytics recommendations grouped by repeat and avoid candidates.
 *
 * @param records - Analytics records to summarize
 * @returns Markdown lines for the recommendations report
 */
export function renderAnalyticsRecommendations(records: AnalyticsRecord[]): string[] {
  const classified = records.map(classifyRecommendation);
  const repeatCandidates = classified.flatMap((recommendation) =>
    recommendation.kind === "repeat" ? [recommendation.value] : [],
  );
  const avoidCandidates = classified.flatMap((recommendation) =>
    recommendation.kind === "avoid" ? [recommendation.value] : [],
  );
  const mixedCandidates = classified.flatMap((recommendation) =>
    recommendation.kind === "mixed" ? [recommendation.value] : [],
  );
  return [
    "### Repeat candidates",
    "",
    ...recommendationLines(repeatCandidates, "No repeat candidate yet."),
    "",
    "### Avoid without revision",
    "",
    ...recommendationLines(avoidCandidates, "No avoid candidate yet."),
    "",
    "### Mixed signals to inspect",
    "",
    ...recommendationLines(mixedCandidates, "No mixed-signal candidate yet."),
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

type ClassifiedRecommendation =
  | { kind: "avoid"; value: Recommendation }
  | { kind: "mixed"; value: Recommendation }
  | { kind: "none" }
  | { kind: "repeat"; value: Recommendation };

function classifyRecommendation(record: AnalyticsRecord): ClassifiedRecommendation {
  const repeat = repeatRecommendation(record);
  const avoid = avoidRecommendation(record);
  if (repeat && avoid) {
    return {
      kind: "mixed",
      value: {
        reasons: [
          `repeat signals: ${repeat.reasons.join(", ")}`,
          `avoid signals: ${avoid.reasons.join(", ")}`,
        ],
        record,
      },
    };
  }
  if (repeat) {
    return { kind: "repeat", value: repeat };
  }
  if (avoid) {
    return { kind: "avoid", value: avoid };
  }
  return { kind: "none" };
}

/**
 * Identifies a record as a repeat candidate when it meets one or more strong performance signals.
 *
 * @returns The recommendation and its reasons if the record matches at least one repeat criterion, `null` otherwise.
 */
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

/**
 * Identifies analytics records that should be avoided without revision.
 *
 * @param record - The analytics record to evaluate
 * @returns The recommendation with matching reasons, or `null` when no avoid criteria are met
 */
function avoidRecommendation(record: AnalyticsRecord): Recommendation | null {
  const reasons = [
    record.ctr !== undefined && record.ctr < 0.025 ? "weak CTR" : null,
    record.averagePercentageViewed !== undefined && record.averagePercentageViewed < 0.25
      ? "weak retention"
      : null,
  ].filter(isString);
  return reasons.length > 0 ? { reasons, record } : null;
}

/**
 * Formats recommendation entries as Markdown bullet lines.
 *
 * @param recommendations - The recommendations to render.
 * @param emptyText - The fallback bullet text used when there are no recommendations.
 * @returns Markdown bullet lines for the provided recommendations, or a single fallback bullet when the list is empty.
 */
function recommendationLines(recommendations: Recommendation[], emptyText: string): string[] {
  if (recommendations.length === 0) {
    return [`- ${emptyText}`];
  }
  return recommendations.map(({ reasons, record }) => {
    const confidence = analyticsRecordConfidence(record);
    return `- ${inlineText(record.title ?? record.videoId)} (${record.runId ?? "unmapped"}): ${reasons.join(", ")} (confidence: ${confidence.level}; ${confidence.details}).`;
  });
}

/**
 * Determines whether a value is a string.
 *
 * @param value - The value to check.
 * @returns `true` if `value` is a string, `false` otherwise.
 */
function isString(value: string | null): value is string {
  return value !== null;
}

/**
 * Normalizes text for inline Markdown use.
 *
 * @returns The input with line breaks replaced by spaces and surrounding whitespace removed.
 */
function inlineText(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ").trim();
}
