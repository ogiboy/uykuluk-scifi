import type { RenderPlan } from "./renderPlanSchemas.js";
import type { DraftRenderTimeline } from "./renderTimeline.js";

type PopupTextFilterInput = {
  inputLabel: string;
  outputLabel: string;
  renderPlan: RenderPlan;
  timeline: DraftRenderTimeline;
};

export type PopupTextWindow = { endSeconds: number; startSeconds: number };

const ffmpegEscape = String.fromCodePoint(92);
const ffmpegEscapedComma = String.raw`\,`;

/**
 * Builds FFmpeg drawtext filters for scene-timed popup-card copy.
 *
 * @param input - Render plan, timeline, and label wiring for the filter chain.
 * @returns Filter expressions that draw popup text on top of the popup card overlay.
 */
export function buildPopupTextFilters(input: PopupTextFilterInput): string[] {
  const specs = popupTextSpecs(input.renderPlan, input.timeline);
  let currentLabel = input.inputLabel;
  return specs.flatMap((spec, index) => {
    const cardLabel = `popupCard${index}`;
    const outputLabel = index === specs.length - 1 ? input.outputLabel : `popupText${index}`;
    const enable = `between(t${ffmpegEscapedComma}${formatTime(
      spec.startSeconds,
    )}${ffmpegEscapedComma}${formatTime(spec.endSeconds)})`;
    const text = spec.lines.map(escapeDrawtextText).join("\n");
    const filters = [
      `[${currentLabel}]drawbox=x=iw-404:y=134:w=352:h=156:color=0x020816@1:t=fill:enable='${enable}'[${cardLabel}]`,
      `[${cardLabel}]drawtext=text='${text}':fontcolor=white:fontsize=20:line_spacing=6:x=W-392:y=150:enable='${enable}'[${outputLabel}]`,
    ];
    currentLabel = outputLabel;
    return filters;
  });
}

export function hasPopupText(renderPlan: RenderPlan, timeline: DraftRenderTimeline): boolean {
  return popupTextSpecs(renderPlan, timeline).length > 0;
}

/**
 * Returns the exact scene windows in which the popup-card bitmap may be shown.
 *
 * @param renderPlan - The plan containing optional popup copy per scene.
 * @param timeline - The final draft timeline including bookend offsets.
 * @returns Popup visibility windows aligned to scene timing.
 */
export function popupTextWindows(
  renderPlan: RenderPlan,
  timeline: DraftRenderTimeline,
): PopupTextWindow[] {
  return popupTextSpecs(renderPlan, timeline).map(({ startSeconds, endSeconds }) => ({
    startSeconds,
    endSeconds,
  }));
}

function popupTextSpecs(renderPlan: RenderPlan, timeline: DraftRenderTimeline) {
  const sceneText = new Map(
    renderPlan.scenes.flatMap((scene) =>
      scene.popupCardText ? [[scene.sceneIndex, wrapPopupText(scene.popupCardText)]] : [],
    ),
  );
  let cursor = 0;
  const specs: Array<{ endSeconds: number; lines: string[]; startSeconds: number }> = [];
  for (const item of timeline) {
    const startSeconds = cursor;
    const endSeconds = cursor + item.durationSeconds;
    cursor = endSeconds;
    const lines = item.sceneIndex ? sceneText.get(item.sceneIndex) : undefined;
    if (lines) {
      specs.push({ endSeconds, lines, startSeconds });
    }
  }
  return specs;
}

function wrapPopupText(text: string): string[] {
  const plainText = text
    .replaceAll("**", "")
    .replaceAll("__", "")
    .replaceAll("`", "")
    .replaceAll(/\s+/gu, " ");
  return wrapWords(plainText, 26).slice(0, 6);
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
