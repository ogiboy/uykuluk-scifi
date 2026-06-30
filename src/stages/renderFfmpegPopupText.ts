import type { RenderPlan } from "./renderPlanSchemas.js";
import type { DraftRenderTimeline } from "./renderTimeline.js";

type PopupTextFilterInput = {
  inputLabel: string;
  outputLabel: string;
  renderPlan: RenderPlan;
  timeline: DraftRenderTimeline;
};

const ffmpegEscape = String.fromCodePoint(92);

/**
 * Builds FFmpeg drawtext filters for scene-timed popup-card copy.
 *
 * @param input - Render plan, timeline, and label wiring for the filter chain.
 * @returns Filter expressions that draw popup text on top of the popup card overlay.
 */
export function buildPopupTextFilters(input: PopupTextFilterInput): string[] {
  const specs = popupTextSpecs(input.renderPlan, input.timeline);
  let currentLabel = input.inputLabel;
  return specs.map((spec, index) => {
    const outputLabel = index === specs.length - 1 ? input.outputLabel : `popupText${index}`;
    const filter = `[${currentLabel}]drawtext=text='${escapeDrawtextText(
      spec.text,
    )}':fontcolor=white:fontsize=24:line_spacing=8:x=W-395:y=150:enable='between(t\\,${formatTime(
      spec.startSeconds,
    )}\\,${formatTime(spec.endSeconds)})'[${outputLabel}]`;
    currentLabel = outputLabel;
    return filter;
  });
}

export function hasPopupText(renderPlan: RenderPlan, timeline: DraftRenderTimeline): boolean {
  return popupTextSpecs(renderPlan, timeline).length > 0;
}

function popupTextSpecs(renderPlan: RenderPlan, timeline: DraftRenderTimeline) {
  const sceneText = new Map(
    renderPlan.scenes.flatMap((scene) =>
      scene.popupCardText ? [[scene.sceneIndex, wrapPopupText(scene.popupCardText)]] : [],
    ),
  );
  let cursor = 0;
  const specs: Array<{ endSeconds: number; startSeconds: number; text: string }> = [];
  for (const item of timeline) {
    const startSeconds = cursor;
    const endSeconds = cursor + item.durationSeconds;
    cursor = endSeconds;
    const text = item.sceneIndex ? sceneText.get(item.sceneIndex) : undefined;
    if (text) {
      specs.push({ endSeconds, startSeconds, text });
    }
  }
  return specs;
}

function wrapPopupText(text: string): string {
  const lines = wrapWords(text.replaceAll(/\s+/gu, " "), 28).slice(0, 5);
  return lines.join(`${ffmpegEscape}n`);
}

function wrapWords(text: string, maxLength: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.trim().split(/\s+/u)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function escapeDrawtextText(value: string): string {
  return value
    .replaceAll(ffmpegEscape, `${ffmpegEscape}${ffmpegEscape}`)
    .replaceAll(":", `${ffmpegEscape}:`)
    .replaceAll("'", `${ffmpegEscape}'`)
    .replaceAll(",", `${ffmpegEscape},`)
    .replaceAll("%", `${ffmpegEscape}%`);
}

function formatTime(value: number): string {
  return Number(value.toFixed(2)).toString();
}
