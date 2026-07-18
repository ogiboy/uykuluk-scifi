import { z } from "zod";
import { episodeCreationRequestSchema } from "../stages/episode/episodeSnapshotContracts.js";
import { elevenLabsDiagnosticSmokeRequestSchema } from "../stages/voice/elevenLabsDiagnosticSmoke.js";
import type { StudioMutationActionId } from "./actionServiceMetadata.js";
import {
  analyticsImportRequestSchema,
  channelHandoffDecisionRequestSchema,
  emptyRequestSchema,
  ideaApprovalRequestSchema,
  localModelCandidateEvalRequestSchema,
  packageArtifactRevisionRequestSchema,
  promptProfileSaveRequestSchema,
  renderDecisionRequestSchema,
  runOnlyRequestSchema,
  scriptApprovalRequestSchema,
  scriptRevisionRequestSchema,
  settingsSaveRequestSchema,
  voicePreviewRequestSchema,
  voiceReselectionRequestSchema,
  voiceRunRequestSchema,
  voiceSelectionRequestSchema,
} from "./actionServiceRequestSchemas.js";
import {
  hostedVisualGenerationRequestSchema,
  hostedVisualPlanRequestSchema,
  visualDecisionRequestSchema,
  visualImportRequestSchema,
  visualRegenerationRequestSchema,
} from "./visualActionRequestSchemas.js";

export const studioMutationRequestSchemaByAction = {
  "analytics.import": analyticsImportRequestSchema,
  "analytics.report": emptyRequestSchema,
  "channel-handoff.decide": channelHandoffDecisionRequestSchema,
  "channel-handoff.run": runOnlyRequestSchema,
  "cost.approve": runOnlyRequestSchema,
  "doctor.run": emptyRequestSchema,
  "estimate.run": runOnlyRequestSchema,
  "evidence.run": runOnlyRequestSchema,
  "idea.approve": ideaApprovalRequestSchema,
  "ideas.run": emptyRequestSchema,
  "settings.save": settingsSaveRequestSchema,
  "promptProfiles.save": promptProfileSaveRequestSchema,
  "episodes.create": episodeCreationRequestSchema,
  "providers.elevenlabs.smoke": elevenLabsDiagnosticSmokeRequestSchema,
  "model-eval.run": emptyRequestSchema,
  "model-eval-candidates.run": localModelCandidateEvalRequestSchema,
  "package.run": runOnlyRequestSchema,
  "publish.schedule": runOnlyRequestSchema,
  "readiness.run": runOnlyRequestSchema,
  "render.approve": runOnlyRequestSchema,
  "render.decide": renderDecisionRequestSchema,
  "render.review": runOnlyRequestSchema,
  "render.revise": runOnlyRequestSchema,
  "render.run": runOnlyRequestSchema,
  "render-plan.review": runOnlyRequestSchema,
  "render-plan.run": runOnlyRequestSchema,
  "review-bundle.run": runOnlyRequestSchema,
  "script.approve": scriptApprovalRequestSchema,
  "script.review": runOnlyRequestSchema,
  "script.revise": scriptRevisionRequestSchema,
  "script.run": runOnlyRequestSchema,
  "package-artifact.revise": packageArtifactRevisionRequestSchema,
  "upload.private": runOnlyRequestSchema,
  "visuals.decide": visualDecisionRequestSchema,
  "visuals.import": visualImportRequestSchema,
  "visuals.plan-hosted": hostedVisualPlanRequestSchema,
  "visuals.generate-hosted": hostedVisualGenerationRequestSchema,
  "visuals.prepare": runOnlyRequestSchema,
  "visuals.regenerate": visualRegenerationRequestSchema,
  "voice.candidates": runOnlyRequestSchema,
  "voice.preview": voicePreviewRequestSchema,
  "voice.reselect": voiceReselectionRequestSchema,
  "voice.review": runOnlyRequestSchema,
  "voice.run": voiceRunRequestSchema,
  "voice.select": voiceSelectionRequestSchema,
} as const satisfies Record<StudioMutationActionId, z.ZodType>;

export type StudioActionRequestById = {
  [ActionId in keyof typeof studioMutationRequestSchemaByAction]: z.infer<
    (typeof studioMutationRequestSchemaByAction)[ActionId]
  >;
};
