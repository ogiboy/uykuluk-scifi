export const studioMutationActionIds = [
  "idea.approve",
  "script.approve",
  "cost.approve",
  "render.approve",
  "render.decide",
  "channel-handoff.decide",
  "ideas.run",
  "script.run",
  "script.review",
  "script.revise",
  "package.run",
  "package-artifact.revise",
  "render-plan.run",
  "render-plan.review",
  "estimate.run",
  "evidence.run",
  "readiness.run",
  "voice.run",
  "voice.review",
  "render.run",
  "render.review",
  "review-bundle.run",
  "channel-handoff.run",
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
    actionId: "render.decide",
    availability: "ready-for-cli",
    cliCommand:
      "pnpm producer decide render --run <run_id> --decision <decision> --notes <notes> --reviewed-by <name>",
    coreExport: "recordRenderDecision",
    coreModule: "src/stages/renderDecision.ts",
    description:
      "Record exactly one local draft-render review decision without approving upload or publish.",
  },
  {
    actionId: "channel-handoff.decide",
    availability: "ready-for-cli",
    cliCommand:
      "pnpm producer decide channel-handoff --run <run_id> --decision <decision> --thumbnail-candidate <candidate_id> --notes <notes> --reviewed-by <name>",
    coreExport: "recordChannelHandoffDecision",
    coreModule: "src/stages/channelHandoffDecision.ts",
    description:
      "Record exactly one manual channel-handoff decision without uploading or publishing.",
  },
  {
    actionId: "ideas.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer ideas",
    coreExport: "runIdeas",
    coreModule: "src/stages/ideas.ts",
    description: "Start a new local idea-generation run through the canonical workflow.",
  },
  {
    actionId: "script.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer script --run <run_id>",
    coreExport: "generateScript",
    coreModule: "src/stages/script.ts",
    description: "Generate a script for an approved idea through the canonical workflow.",
  },
  {
    actionId: "script.review",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer review script --run <run_id>",
    coreExport: "reviewScript",
    coreModule: "src/stages/reviewScript.ts",
    description: "Run the local script review and persist review evidence for operator approval.",
  },
  {
    actionId: "script.revise",
    availability: "ready-for-cli",
    cliCommand:
      "pnpm producer revise script --run <run_id> --file <temp_file> --reason <reason> --editor <name>",
    coreExport: "reviseScript",
    coreModule: "src/revisions/scriptRevision.ts",
    description:
      "Record an attributable script revision, invalidate stale review/approval evidence, and return to script review.",
  },
  {
    actionId: "package.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer package --run <run_id>",
    coreExport: "generateProductionPackage",
    coreModule: "src/stages/productionPackage.ts",
    description: "Generate the approved-script production package artifacts.",
  },
  {
    actionId: "package-artifact.revise",
    availability: "ready-for-cli",
    cliCommand:
      "pnpm producer revise package-artifact --run <run_id> --artifact <target> --file <temp_file> --reason <reason> --editor <name>",
    coreExport: "revisePackageArtifact",
    coreModule: "src/revisions/packageArtifactRevision.ts",
    description:
      "Record a bounded production-package artifact revision and refresh manifest evidence before downstream work.",
  },
  {
    actionId: "render-plan.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer render-plan --run <run_id>",
    coreExport: "generateRenderPlan",
    coreModule: "src/stages/renderPlan.ts",
    description: "Generate the deterministic render plan and contact sheet artifacts.",
  },
  {
    actionId: "render-plan.review",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer review render-plan --run <run_id>",
    coreExport: "reviewRenderPlan",
    coreModule: "src/stages/reviewRenderPlan.ts",
    description: "Open the local render-plan review handoff through the canonical review command.",
  },
  {
    actionId: "estimate.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer estimate --run <run_id>",
    coreExport: "estimateCost",
    coreModule: "src/stages/estimate.ts",
    description: "Regenerate the current run cost estimate before paid or risky work.",
  },
  {
    actionId: "evidence.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer evidence --run <run_id>",
    coreExport: "generateEvidenceBundle",
    coreModule: "src/stages/evidence.ts",
    description: "Regenerate the evidence bundle from the current persisted run artifacts.",
  },
  {
    actionId: "readiness.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer readiness --run <run_id>",
    coreExport: "runReadiness",
    coreModule: "src/stages/readiness.ts",
    description: "Run readiness diagnostics for the current persisted run state.",
  },
  {
    actionId: "voice.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer voice --run <run_id>",
    coreExport: "generateVoiceoverAudio",
    coreModule: "src/stages/voice.ts",
    description: "Generate local voiceover audio only when local TTS config and gates allow it.",
  },
  {
    actionId: "voice.review",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer review voice --run <run_id>",
    coreExport: "reviewVoiceover",
    coreModule: "src/stages/reviewVoiceover.ts",
    description: "Open the local voiceover review handoff for timing and quality checks.",
  },
  {
    actionId: "render.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer render --run <run_id>",
    coreExport: "renderDraft",
    coreModule: "src/stages/render.ts",
    description: "Generate a local FFmpeg draft render after explicit render approval.",
  },
  {
    actionId: "render.review",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer review render --run <run_id>",
    coreExport: "reviewDraftRender",
    coreModule: "src/stages/reviewRender.ts",
    description: "Open the local draft-render review handoff without uploading or publishing.",
  },
  {
    actionId: "review-bundle.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer review-bundle --run <run_id>",
    coreExport: "createFinalReviewBundle",
    coreModule: "src/stages/finalReviewBundle.ts",
    description: "Create the local final review bundle after an accepted draft-render decision.",
  },
  {
    actionId: "channel-handoff.run",
    availability: "ready-for-cli",
    cliCommand: "pnpm producer channel-handoff --run <run_id>",
    coreExport: "createChannelHandoff",
    coreModule: "src/stages/channelHandoff.ts",
    description:
      "Create the manual channel handoff package while upload and publish remain disabled.",
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
