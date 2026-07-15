// prettier-ignore
export const studioMutationActionIds = [
  "idea.approve", "script.approve", "cost.approve", "render.approve", "render.decide",
  "channel-handoff.decide", "analytics.import", "analytics.report", "doctor.run", "ideas.run",
  "model-eval.run", "model-eval-candidates.run", "script.run", "script.review", "script.revise", "package.run",
  "package-artifact.revise", "render-plan.run", "render-plan.review", "estimate.run", "evidence.run", "readiness.run",
  "visuals.prepare", "visuals.plan-hosted", "visuals.generate-hosted", "visuals.import", "visuals.decide", "visuals.regenerate",
  "voice.candidates", "voice.preview", "voice.select", "voice.reselect", "voice.run", "voice.review",
  "render.run", "render.review", "render.revise", "review-bundle.run",
  "channel-handoff.run", "upload.private", "publish.schedule",
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

type StudioMutationMetadataRow = readonly [
  StudioMutationActionId,
  StudioMutationAvailability,
  string,
  string,
  string,
  string,
];
const readyForCli: StudioMutationAvailability = "ready-for-cli";
const disabledExternal: StudioMutationAvailability = "disabled-external";
// prettier-ignore
const studioMutationServiceRows = [
  ["idea.approve", readyForCli, "pnpm producer approve idea --run <run_id> --idea <idea_id>", "approveIdea", "src/stages/approveIdea.ts", "Approve one generated idea for the current run."],
  ["script.approve", readyForCli, "pnpm producer approve script --run <run_id>", "approveScript", "src/stages/approveScript.ts", "Approve the currently reviewed script digest, optionally acknowledging warnings."],
  ["cost.approve", readyForCli, "pnpm producer approve cost --run <run_id>", "approvePaidGenerationCost", "src/stages/approveCost.ts", "Approve the exact current paid-generation cost quote digest."],
  ["render.approve", readyForCli, "pnpm producer approve render --run <run_id>", "approveRender", "src/stages/approveRender.ts", "Approve render execution for the current render-plan and voiceover digests."],
  ["render.decide", readyForCli, "pnpm producer decide render --run <run_id> --decision <decision> --notes <notes> --reviewed-by <reviewer> --json", "recordRenderDecision", "src/stages/renderDecision.ts", "Record one local draft-render review decision."],
  ["channel-handoff.decide", readyForCli, "pnpm producer decide channel-handoff --run <run_id> --decision accepted-for-manual-channel-prep --thumbnail-candidate <candidate_id> --notes <notes> --reviewed-by <reviewer> --json", "recordChannelHandoffDecision", "src/stages/channelHandoffDecision.ts", "Record one manual channel-handoff decision."],
  ["analytics.import", readyForCli, "pnpm producer analytics import --file <temp_file>", "importAnalyticsFile", "src/analytics/import.ts", "Import operator-provided CSV/JSON analytics into ignored local artifacts."],
  ["analytics.report", readyForCli, "pnpm producer analytics report", "refreshSavedAnalyticsReport", "src/analytics/import.ts", "Refresh the local manual analytics report from the saved dataset."],
  ["doctor.run", readyForCli, "pnpm producer doctor", "runDoctor", "src/diagnostics/doctor.ts", "Refresh local config, provider, asset, media-toolchain, and publish-safety diagnostics."],
  ["model-eval.run", readyForCli, "pnpm producer eval local-model", "runLocalModelEval", "src/diagnostics/localModelEval.ts", "Refresh single-model local parser-contract evaluation evidence."],
  ["model-eval-candidates.run", readyForCli, "pnpm producer eval local-model-candidates --candidate <model>", "runLocalModelCandidateEval", "src/diagnostics/localModelCandidateEval.ts", "Compare local model candidates through parser-contract checks without mutating config."],
  ["ideas.run", readyForCli, "pnpm producer ideas", "runIdeas", "src/stages/ideas.ts", "Start a new local idea-generation run through the canonical workflow."],
  ["script.run", readyForCli, "pnpm producer script --run <run_id>", "generateScript", "src/stages/script.ts", "Generate a script for an approved idea through the canonical workflow."],
  ["script.review", readyForCli, "pnpm producer review script --run <run_id>", "reviewScript", "src/stages/reviewScript.ts", "Run the local script review and persist review evidence for operator approval."],
  ["script.revise", readyForCli, "pnpm producer revise script --run <run_id> --file <temp_file> --json", "reviseScript", "src/revisions/scriptRevision.ts", "Record a script revision and invalidate stale review evidence."],
  ["package.run", readyForCli, "pnpm producer package --run <run_id>", "generateProductionPackage", "src/stages/productionPackage.ts", "Generate the approved-script production package artifacts."],
  ["package-artifact.revise", readyForCli, "pnpm producer revise package-artifact --run <run_id> --file <temp_file> --json", "revisePackageArtifact", "src/revisions/packageArtifactRevision.ts", "Record a bounded production-package artifact revision."],
  ["visuals.prepare", readyForCli, "pnpm producer visuals prepare --run <run_id>", "prepareStaticVisuals", "src/stages/visuals.ts", "Prepare the deterministic 12-24 beat static visual fallback for explicit Studio review."],
  ["visuals.plan-hosted", readyForCli, "pnpm producer visuals plan-hosted --run <run_id> --scenes <scene_indexes> --purpose <purpose>", "prepareHostedVisualGenerationPlan", "src/stages/visuals/visualGenerationPlanStore.ts", "Bind selected visual beats to one exact FLUX.2 Pro plan before cost approval."],
  ["visuals.generate-hosted", readyForCli, "pnpm producer visuals generate-hosted --run <run_id> --binding-digest <sha256> --quote-digest <sha256> --approval-id <approval_id> --confirm-paid-operation", "generateHostedVisuals", "src/stages/visuals/hostedVisualGeneration.ts", "Execute only the exact approved hosted visual batch and promote settled images into review."],
  ["visuals.import", readyForCli, "pnpm producer visuals import --run <run_id> --scene <scene_index> --file <temp_file> --expected-manifest-digest <sha256> --expected-active-revisions-file <temp_json>", "importManualVisual", "src/stages/visuals.ts", "Import one operator-selected PNG or JPEG as the next revision for a visual beat."],
  ["visuals.decide", readyForCli, "pnpm producer visuals decide --run <run_id> --scenes <scene_indexes> --decision <approved_or_rejected> --reviewed-by <operator> --notes <notes> --expected-manifest-digest <sha256> --expected-active-revisions-file <temp_json>", "decideVisuals", "src/stages/visuals.ts", "Record attributed approve or reject decisions for active visual revisions."],
  ["visuals.regenerate", readyForCli, "pnpm producer visuals regenerate --run <run_id> --scenes <scene_indexes> --expected-manifest-digest <sha256> --expected-active-revisions-file <temp_json>", "regenerateRejectedStaticVisuals", "src/stages/visuals/visualRegeneration.ts", "Create deterministic next revisions for explicitly rejected static visual beats."],
  ["render-plan.run", readyForCli, "pnpm producer render-plan --run <run_id>", "generateRenderPlan", "src/stages/renderPlan.ts", "Generate the deterministic render plan and contact sheet artifacts."],
  ["render-plan.review", readyForCli, "pnpm producer review render-plan --run <run_id>", "reviewRenderPlan", "src/stages/reviewRenderPlan.ts", "Open the local render-plan review handoff through the canonical review command."],
  ["estimate.run", readyForCli, "pnpm producer estimate --run <run_id>", "estimateCost", "src/stages/estimate.ts", "Regenerate the current run cost estimate before paid or risky work."],
  ["evidence.run", readyForCli, "pnpm producer evidence --run <run_id>", "generateEvidenceBundle", "src/stages/evidence.ts", "Regenerate the evidence bundle from the current persisted run artifacts."],
  ["readiness.run", readyForCli, "pnpm producer readiness --run <run_id>", "runReadiness", "src/stages/readiness.ts", "Run readiness diagnostics for the current persisted run state."],
  ["voice.candidates", readyForCli, "pnpm producer voice-candidates --run <run_id>", "generateVoiceCandidates", "src/stages/voiceCandidates.ts", "Fetch and persist the bounded ElevenLabs candidate catalog for explicit operator audition."],
  ["voice.preview", readyForCli, "pnpm producer voice-preview --run <run_id> --voice <voice_id>", "generateVoicePreview", "src/stages/voicePreview.ts", "Persist one bounded candidate preview for local playback without exposing provider media URLs."],
  ["voice.select", readyForCli, "pnpm producer voice-select --run <run_id> --voice <voice_id> --reviewed-by <operator> --notes <notes>", "selectVoice", "src/stages/voiceSelection.ts", "Select an auditioned voice with operator attribution and explicit production-rights confirmation when required."],
  ["voice.reselect", readyForCli, "pnpm producer voice-reselect --run <run_id> --reviewed-by <operator> --reason <reason>", "reviseVoiceSelection", "src/revisions/voiceSelectionRevision.ts", "Archive unspent voice selection and approval evidence before reopening exact voice selection."],
  ["voice.run", readyForCli, "pnpm producer voice --run <run_id>", "generateVoiceoverAudio", "src/stages/voice.ts", "Generate voiceover through the configured local or approval-bound hosted TTS provider."],
  ["voice.review", readyForCli, "pnpm producer review voice --run <run_id>", "reviewVoiceover", "src/stages/reviewVoiceover.ts", "Open the voiceover review handoff for timing and quality checks."],
  ["render.run", readyForCli, "pnpm producer render --run <run_id>", "renderDraft", "src/stages/render.ts", "Generate a local FFmpeg draft render after explicit render approval."],
  ["render.review", readyForCli, "pnpm producer review render --run <run_id>", "reviewDraftRender", "src/stages/reviewRender.ts", "Open the local draft-render review handoff without uploading or publishing."],
  ["render.revise", readyForCli, "pnpm producer revise render --run <run_id>", "reviseRender", "src/revisions/renderRevision.ts", "Archive a non-accepted local draft, invalidate render approval, and return to the guarded render workflow."],
  ["review-bundle.run", readyForCli, "pnpm producer review-bundle --run <run_id>", "createFinalReviewBundle", "src/stages/finalReviewBundle.ts", "Create the local final review bundle after an accepted draft-render decision."],
  ["channel-handoff.run", readyForCli, "pnpm producer channel-handoff --run <run_id>", "createChannelHandoff", "src/stages/channelHandoff.ts", "Create the manual channel handoff package while upload remains disabled."],
  ["upload.private", disabledExternal, "pnpm producer upload private --run <run_id>", "runPrivateUploadPlaceholder", "src/youtube/uploadDisabled.ts", "Future private-upload action; disabled until upload approval/config exist."],
  ["publish.schedule", disabledExternal, "pnpm producer publish schedule --run <run_id>", "runPublishPlaceholder", "src/youtube/uploadDisabled.ts", "Future scheduled/public publish action; explicitly out of scope for v1."],
] as const satisfies readonly StudioMutationMetadataRow[];
export const studioMutationServiceMetadata = studioMutationServiceRows.map(
  ([actionId, availability, cliCommand, coreExport, coreModule, description]) => ({
    actionId,
    availability,
    cliCommand,
    coreExport,
    coreModule,
    description,
  }),
) satisfies readonly StudioMutationServiceMetadata[];
