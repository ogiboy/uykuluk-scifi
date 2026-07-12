import type { DraftRenderOverlay } from "./renderComposition.js";
import type { PopupTextWindow } from "./renderFfmpegPopupText.js";
import type { DraftRenderTiming } from "./renderTimeline.js";

export function buildTimedOverlayFilters(input: {
  finalOutputLabel: string;
  firstInputLabel: string;
  firstOverlayInputIndex: number;
  overlays: DraftRenderOverlay[];
  popupWindows: PopupTextWindow[];
  timing: DraftRenderTiming;
}): { filters: string[]; outputLabel: string } {
  let inputLabel = input.firstInputLabel;
  const filters = input.overlays.flatMap((overlay, index) => {
    const scaledLabel = `ov${index}`;
    const outputLabel =
      index === input.overlays.length - 1 ? input.finalOutputLabel : `base${index + 1}`;
    const inputIndex = input.firstOverlayInputIndex + index;
    const filters = [
      `[${inputIndex}:v]scale=${overlay.width}:-1[${scaledLabel}]`,
      `[${inputLabel}][${scaledLabel}]overlay=${overlay.x}:${overlay.y}${overlayEnable(
        overlay,
        input.timing,
        input.popupWindows,
      )}[${outputLabel}]`,
    ];
    inputLabel = outputLabel;
    return filters;
  });
  return { filters, outputLabel: filters.length > 0 ? inputLabel : input.firstInputLabel };
}

function overlayEnable(
  overlay: DraftRenderOverlay,
  timing: DraftRenderTiming,
  popupWindows: PopupTextWindow[],
): string {
  const sceneStart = timing.introDurationSeconds;
  const sceneEnd = sceneStart + timing.sceneAudioDurationSeconds;
  switch (overlay.asset.role) {
    case "lower-third":
      return `:enable='${betweenExpression(
        sceneStart,
        sceneStart + Math.min(8, timing.sceneAudioDurationSeconds),
      )}'`;
    case "waveform-overlay":
      return `:enable='${betweenExpression(sceneStart, sceneEnd)}'`;
    case "popup-card":
      return `:enable='${
        popupWindows.length > 0
          ? popupWindows
              .map((window) => betweenExpression(window.startSeconds, window.endSeconds))
              .join("+")
          : "0"
      }'`;
    default:
      return "";
  }
}

function betweenExpression(start: number, end: number): string {
  const comma = String.raw`\,`;
  return `between(t${comma}${formatSeconds(start)}${comma}${formatSeconds(end)})`;
}

function formatSeconds(value: number): string {
  return Number(value.toFixed(2)).toString();
}
