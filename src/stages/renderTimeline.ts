import { SafeExitError } from "../core/errors.js";
import { AssetRef, RenderPlan } from "./renderPlanSchemas.js";

type DraftRenderTimelineSegment = "intro" | "outro" | "scene";

export type DraftRenderTimeline = Array<{
  segment: DraftRenderTimelineSegment;
  sceneIndex?: number;
  durationSeconds: number;
  backgroundAsset: AssetRef;
}>;

export function buildDraftRenderTimeline(
  renderPlan: RenderPlan,
  targetDurationSeconds: number,
): DraftRenderTimeline {
  const firstScene = renderPlan.scenes[0];
  if (!firstScene) {
    throw new SafeExitError("Draft render requires at least one render-plan scene.");
  }
  const targetDuration = positiveDuration(targetDurationSeconds);
  const timeline: DraftRenderTimeline = [];
  const bookendDurations = allocateBookendDurations(renderPlan, targetDuration);
  if (bookendDurations.intro > 0 && renderPlan.bookends) {
    timeline.push({
      segment: "intro",
      durationSeconds: bookendDurations.intro,
      backgroundAsset: renderPlan.bookends.intro.asset,
    });
  }
  let remainingSeconds = bookendDurations.scenes;
  for (const scene of renderPlan.scenes) {
    if (remainingSeconds <= 0) {
      break;
    }
    const durationSeconds = positiveDuration(Math.min(scene.durationSeconds, remainingSeconds));
    if (durationSeconds > 0) {
      timeline.push({
        segment: "scene",
        sceneIndex: scene.sceneIndex,
        durationSeconds,
        backgroundAsset: scene.backgroundAsset,
      });
      remainingSeconds = roundSeconds(remainingSeconds - durationSeconds);
    }
  }
  if (remainingSeconds > 0) {
    extendLastTimelineScene(timeline, firstScene, remainingSeconds);
  }
  if (bookendDurations.outro > 0 && renderPlan.bookends) {
    timeline.push({
      segment: "outro",
      durationSeconds: bookendDurations.outro,
      backgroundAsset: renderPlan.bookends.outro.asset,
    });
  }
  return timeline;
}

export function clampRenderDuration(actualSeconds: number, maxSeconds?: number): number {
  if (!maxSeconds || maxSeconds <= 0) {
    return positiveDuration(actualSeconds);
  }
  return positiveDuration(Math.min(actualSeconds, maxSeconds));
}

function extendLastTimelineScene(
  timeline: DraftRenderTimeline,
  firstScene: RenderPlan["scenes"][number],
  remainingSeconds: number,
): void {
  const lastSceneIndex = lastSceneTimelineIndex(timeline);
  const lastSceneItem = lastSceneIndex === -1 ? undefined : timeline[lastSceneIndex];
  if (lastSceneItem) {
    timeline[lastSceneIndex] = {
      ...lastSceneItem,
      durationSeconds: positiveDuration(lastSceneItem.durationSeconds + remainingSeconds),
    };
    return;
  }
  timeline.push({
    segment: "scene",
    sceneIndex: firstScene.sceneIndex,
    durationSeconds: positiveDuration(remainingSeconds),
    backgroundAsset: firstScene.backgroundAsset,
  });
}

function lastSceneTimelineIndex(timeline: DraftRenderTimeline): number {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    if (timeline[index]?.segment === "scene") {
      return index;
    }
  }
  return -1;
}

function allocateBookendDurations(
  renderPlan: RenderPlan,
  targetDurationSeconds: number,
): { intro: number; outro: number; scenes: number } {
  if (!renderPlan.bookends) {
    return { intro: 0, outro: 0, scenes: targetDurationSeconds };
  }
  const minimumSceneSeconds = 0.1;
  const minimumBookendSeconds = 0.1;
  const bookendBudget = roundSeconds(Math.max(0, targetDurationSeconds - minimumSceneSeconds));
  if (bookendBudget < minimumBookendSeconds * 2) {
    return { intro: 0, outro: 0, scenes: targetDurationSeconds };
  }
  const desiredIntro = positiveDuration(renderPlan.bookends.intro.durationSeconds);
  const desiredOutro = positiveDuration(renderPlan.bookends.outro.durationSeconds);
  const desiredBookends = roundSeconds(desiredIntro + desiredOutro);
  const intro =
    desiredBookends <= bookendBudget
      ? desiredIntro
      : roundSeconds(
          Math.max(minimumBookendSeconds, (desiredIntro / desiredBookends) * bookendBudget),
        );
  const outro =
    desiredBookends <= bookendBudget
      ? desiredOutro
      : roundSeconds(Math.max(minimumBookendSeconds, bookendBudget - intro));
  const scenes = roundSeconds(targetDurationSeconds - intro - outro);
  if (scenes < minimumSceneSeconds) {
    return { intro: 0, outro: 0, scenes: targetDurationSeconds };
  }
  return { intro, outro, scenes };
}

function positiveDuration(seconds: number): number {
  return Math.max(0.1, roundSeconds(seconds));
}

function roundSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
