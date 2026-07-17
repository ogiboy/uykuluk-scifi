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

export type StudioActionRequestById = {
  "analytics.import": z.infer<typeof analyticsImportRequestSchema>;
  "analytics.report": z.infer<typeof emptyRequestSchema>;
  "channel-handoff.decide": z.infer<typeof channelHandoffDecisionRequestSchema>;
  "channel-handoff.run": z.infer<typeof runOnlyRequestSchema>;
  "cost.approve": z.infer<typeof runOnlyRequestSchema>;
  "doctor.run": z.infer<typeof emptyRequestSchema>;
  "estimate.run": z.infer<typeof runOnlyRequestSchema>;
  "evidence.run": z.infer<typeof runOnlyRequestSchema>;
  "idea.approve": z.infer<typeof ideaApprovalRequestSchema>;
  "ideas.run": z.infer<typeof emptyRequestSchema>;
  "settings.save": z.infer<typeof settingsSaveRequestSchema>;
  "promptProfiles.save": z.infer<typeof promptProfileSaveRequestSchema>;
  "episodes.create": z.infer<typeof episodeCreationRequestSchema>;
  "providers.elevenlabs.smoke": z.infer<typeof elevenLabsDiagnosticSmokeRequestSchema>;
  "model-eval.run": z.infer<typeof emptyRequestSchema>;
  "model-eval-candidates.run": z.infer<typeof localModelCandidateEvalRequestSchema>;
  "package.run": z.infer<typeof runOnlyRequestSchema>;
  "publish.schedule": z.infer<typeof runOnlyRequestSchema>;
  "readiness.run": z.infer<typeof runOnlyRequestSchema>;
  "render.approve": z.infer<typeof runOnlyRequestSchema>;
  "render.decide": z.infer<typeof renderDecisionRequestSchema>;
  "render.review": z.infer<typeof runOnlyRequestSchema>;
  "render.revise": z.infer<typeof runOnlyRequestSchema>;
  "render.run": z.infer<typeof runOnlyRequestSchema>;
  "render-plan.review": z.infer<typeof runOnlyRequestSchema>;
  "render-plan.run": z.infer<typeof runOnlyRequestSchema>;
  "review-bundle.run": z.infer<typeof runOnlyRequestSchema>;
  "script.approve": z.infer<typeof scriptApprovalRequestSchema>;
  "script.review": z.infer<typeof runOnlyRequestSchema>;
  "script.revise": z.infer<typeof scriptRevisionRequestSchema>;
  "script.run": z.infer<typeof runOnlyRequestSchema>;
  "package-artifact.revise": z.infer<typeof packageArtifactRevisionRequestSchema>;
  "upload.private": z.infer<typeof runOnlyRequestSchema>;
  "visuals.decide": z.infer<typeof visualDecisionRequestSchema>;
  "visuals.import": z.infer<typeof visualImportRequestSchema>;
  "visuals.plan-hosted": z.infer<typeof hostedVisualPlanRequestSchema>;
  "visuals.generate-hosted": z.infer<typeof hostedVisualGenerationRequestSchema>;
  "visuals.prepare": z.infer<typeof runOnlyRequestSchema>;
  "visuals.regenerate": z.infer<typeof visualRegenerationRequestSchema>;
  "voice.candidates": z.infer<typeof runOnlyRequestSchema>;
  "voice.preview": z.infer<typeof voicePreviewRequestSchema>;
  "voice.reselect": z.infer<typeof voiceReselectionRequestSchema>;
  "voice.review": z.infer<typeof runOnlyRequestSchema>;
  "voice.run": z.infer<typeof voiceRunRequestSchema>;
  "voice.select": z.infer<typeof voiceSelectionRequestSchema>;
};

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
