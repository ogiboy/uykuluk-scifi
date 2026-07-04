import { z } from "zod";
import {
  analyticsImportRequestSchema as analyticsImportPayloadSchema,
  channelHandoffDecisionRequestSchema as channelHandoffDecisionPayloadSchema,
  emptyRequestSchema as emptyPayloadSchema,
  ideaApprovalRequestSchema as ideaApprovalPayloadSchema,
  packageArtifactRevisionRequestSchema as packageArtifactRevisionPayloadSchema,
  renderDecisionRequestSchema as renderDecisionPayloadSchema,
  runOnlyRequestSchema as runOnlyPayloadSchema,
  scriptApprovalRequestSchema as scriptApprovalPayloadSchema,
  scriptRevisionRequestSchema as scriptRevisionPayloadSchema,
} from "../../../../src/studio/actionServiceContracts";

export function parseIdeaApprovalPayload(
  payload: unknown,
): z.infer<typeof ideaApprovalPayloadSchema> {
  return ideaApprovalPayloadSchema.parse(payload);
}

export function parseScriptApprovalPayload(
  payload: unknown,
): z.infer<typeof scriptApprovalPayloadSchema> {
  return scriptApprovalPayloadSchema.parse(payload);
}

export function parseScriptRevisionPayload(
  payload: unknown,
): z.infer<typeof scriptRevisionPayloadSchema> {
  return scriptRevisionPayloadSchema.parse(payload);
}

export function parsePackageArtifactRevisionPayload(
  payload: unknown,
): z.infer<typeof packageArtifactRevisionPayloadSchema> {
  return packageArtifactRevisionPayloadSchema.parse(payload);
}

export function parseAnalyticsImportPayload(
  payload: unknown,
): z.infer<typeof analyticsImportPayloadSchema> {
  return analyticsImportPayloadSchema.parse(payload);
}

export function parseRunOnlyPayload(payload: unknown): z.infer<typeof runOnlyPayloadSchema> {
  return runOnlyPayloadSchema.parse(payload);
}

export function parseEmptyPayload(payload: unknown): z.infer<typeof emptyPayloadSchema> {
  return emptyPayloadSchema.parse(payload);
}

export function parseRenderDecisionPayload(
  payload: unknown,
): z.infer<typeof renderDecisionPayloadSchema> {
  return renderDecisionPayloadSchema.parse(payload);
}

export function parseChannelHandoffDecisionPayload(
  payload: unknown,
): z.infer<typeof channelHandoffDecisionPayloadSchema> {
  return channelHandoffDecisionPayloadSchema.parse(payload);
}
