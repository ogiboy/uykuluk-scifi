import type { StudioMutationActionId } from "../../../../../src/studio/actionServiceMetadata";

export const studioCliMutationActionIds = [
  "analytics.import",
  "analytics.report",
  "channel-handoff.decide",
  "channel-handoff.run",
  "cost.approve",
  "doctor.run",
  "episodes.create",
  "estimate.run",
  "evidence.run",
  "idea.approve",
  "ideas.run",
  "model-eval-candidates.run",
  "model-eval.run",
  "package.run",
  "promptProfiles.save",
  "providers.elevenlabs.smoke",
  "package-artifact.revise",
  "readiness.run",
  "render.approve",
  "render.decide",
  "render.review",
  "render.revise",
  "render.run",
  "render-plan.review",
  "render-plan.run",
  "review-bundle.run",
  "script.approve",
  "script.review",
  "script.revise",
  "script.run",
  "settings.save",
  "visuals.decide",
  "visuals.import",
  "visuals.plan-hosted",
  "visuals.generate-hosted",
  "visuals.prepare",
  "visuals.regenerate",
  "voice.candidates",
  "voice.preview",
  "voice.reselect",
  "voice.review",
  "voice.run",
  "voice.select",
] as const satisfies readonly Exclude<
  StudioMutationActionId,
  "publish.schedule" | "upload.private"
>[];

export type StudioCliMutationActionId = (typeof studioCliMutationActionIds)[number];

export type RunOnlyCliActionId = Exclude<
  StudioCliMutationActionId,
  | "channel-handoff.decide"
  | "analytics.import"
  | "analytics.report"
  | "doctor.run"
  | "episodes.create"
  | "idea.approve"
  | "ideas.run"
  | "model-eval.run"
  | "model-eval-candidates.run"
  | "package-artifact.revise"
  | "promptProfiles.save"
  | "providers.elevenlabs.smoke"
  | "render.decide"
  | "script.approve"
  | "script.revise"
  | "settings.save"
  | "visuals.decide"
  | "visuals.import"
  | "visuals.plan-hosted"
  | "visuals.generate-hosted"
  | "visuals.regenerate"
  | "voice.preview"
  | "voice.reselect"
  | "voice.run"
  | "voice.select"
>;

export type StudioPreparedCliArgs = Readonly<{
  args: readonly string[];
  cleanup: () => Promise<void>;
}>;

export const runOnlyCliCommand: Record<RunOnlyCliActionId, readonly string[]> = {
  "channel-handoff.run": ["channel-handoff"],
  "cost.approve": ["approve", "cost"],
  "estimate.run": ["estimate"],
  "evidence.run": ["evidence"],
  "package.run": ["package"],
  "readiness.run": ["readiness"],
  "render.approve": ["approve", "render"],
  "render.review": ["review", "render"],
  "render.revise": ["revise", "render"],
  "render.run": ["render"],
  "render-plan.review": ["review", "render-plan"],
  "render-plan.run": ["render-plan"],
  "review-bundle.run": ["review-bundle"],
  "script.review": ["review", "script"],
  "script.run": ["script"],
  "visuals.prepare": ["visuals", "prepare"],
  "voice.candidates": ["voice-candidates"],
  "voice.review": ["review", "voice"],
};

export function prepared(
  args: readonly string[],
  cleanup: () => Promise<void> = async () => {},
): StudioPreparedCliArgs {
  return { args, cleanup };
}
