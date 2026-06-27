export const studioMutationActionIds = [
  "idea.approve",
  "script.approve",
  "cost.approve",
  "render.approve",
  "upload.private",
  "publish.schedule",
] as const;

export type StudioMutationActionId = (typeof studioMutationActionIds)[number];

export type StudioMutationAvailability = "disabled-external" | "ready-for-cli";

export type StudioMutationServiceMetadata = {
  actionId: StudioMutationActionId;
  availability: StudioMutationAvailability;
  cliCommand: string;
  coreExport: string;
  coreModule: string;
  description: string;
};

export const studioMutationServiceMetadata = [
  {
    actionId: "idea.approve",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
    coreExport: "approveIdea",
    coreModule: "src/stages/approveIdea.ts",
    description: "Approve one generated idea for the current run.",
  },
  {
    actionId: "script.approve",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer approve script --run <run_id>",
    coreExport: "approveScript",
    coreModule: "src/stages/approveScript.ts",
    description: "Approve the currently reviewed script digest, optionally acknowledging warnings.",
  },
  {
    actionId: "cost.approve",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer approve cost --run <run_id>",
    coreExport: "approvePaidGenerationCost",
    coreModule: "src/stages/approveCost.ts",
    description: "Approve the exact current paid-generation cost quote digest.",
  },
  {
    actionId: "render.approve",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer approve render --run <run_id>",
    coreExport: "approveRender",
    coreModule: "src/stages/approveRender.ts",
    description: "Approve render execution for the current render-plan and voiceover digests.",
  },
  {
    actionId: "upload.private",
    availability: "disabled-external",
    cliCommand: "pnpm producer upload private --run <run_id>",
    coreExport: "runPrivateUploadPlaceholder",
    coreModule: "src/youtube/uploadDisabled.ts",
    description:
      "Future private-upload action; currently disabled until upload approval/config exist.",
  },
  {
    actionId: "publish.schedule",
    availability: "disabled-external",
    cliCommand: "pnpm producer publish schedule --run <run_id>",
    coreExport: "runPublishPlaceholder",
    coreModule: "src/youtube/uploadDisabled.ts",
    description: "Future scheduled/public publish action; explicitly out of scope for v1.",
  },
] as const satisfies readonly StudioMutationServiceMetadata[];
