import { z } from "zod";
import { producerConfigSchema, type ProducerConfig } from "../../config/schema.js";
import { SafeExitError } from "../../core/errors.js";
import { isValidRunId } from "../../core/runId.js";
import {
  promptProfileDigest,
  promptProfileIdSchema,
  promptProfileSchema,
  type PromptProfile,
} from "../../prompts/profiles/promptProfileStore.js";
import { canonicalJsonDigest } from "../../utils/canonicalJsonDigest.js";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const runIdSchema = z.string().refine(isValidRunId, { message: "Invalid run id." });

export const ideasOperationSettingsPath = "operation/ideas.settings.json";
export const episodeBriefPath = "episode/brief.json";

export const episodeCreationRequestSchema = z.strictObject({
  profileId: promptProfileIdSchema,
  expectedProfileDigest: digestSchema,
  expectedSettingsDigest: digestSchema,
  operatorBrief: z.string().trim().min(1).max(8_000).optional(),
});

const operationSettingsSnapshotBodySchema = z.strictObject({
  schemaVersion: z.literal(1),
  operation: z.literal("ideas"),
  runId: runIdSchema,
  capturedAt: z.iso.datetime(),
  config: producerConfigSchema,
  configDigest: digestSchema,
  profile: promptProfileSchema,
  profileDigest: digestSchema,
});

export const operationSettingsSnapshotSchema = operationSettingsSnapshotBodySchema
  .extend({ digest: digestSchema })
  .superRefine((snapshot, context) => {
    if (snapshot.configDigest !== digest(snapshot.config)) {
      context.addIssue({
        code: "custom",
        message: "Operation settings config digest does not match.",
      });
    }
    if (snapshot.profileDigest !== promptProfileDigest(snapshot.profile)) {
      context.addIssue({
        code: "custom",
        message: "Operation settings profile digest does not match.",
      });
    }
    const { digest: snapshotDigest, ...body } = snapshot;
    if (snapshotDigest !== operationSettingsSnapshotDigest(body)) {
      context.addIssue({
        code: "custom",
        message: "Operation settings snapshot digest does not match.",
      });
    }
  });

const episodeBriefSnapshotBodySchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: runIdSchema,
  createdAt: z.iso.datetime(),
  profileId: promptProfileIdSchema,
  profileDigest: digestSchema,
  operatorBrief: z.string().trim().min(1).max(8_000).optional(),
  operationSettingsDigest: digestSchema,
});

export const episodeBriefSnapshotSchema = episodeBriefSnapshotBodySchema
  .extend({ digest: digestSchema })
  .superRefine((snapshot, context) => {
    const { digest: snapshotDigest, ...body } = snapshot;
    if (snapshotDigest !== episodeBriefSnapshotDigest(body)) {
      context.addIssue({
        code: "custom",
        message: "Episode brief snapshot digest does not match.",
      });
    }
  });

export type EpisodeCreationRequest = z.infer<typeof episodeCreationRequestSchema>;
export type OperationSettingsSnapshot = z.infer<typeof operationSettingsSnapshotSchema>;
export type EpisodeBriefSnapshot = z.infer<typeof episodeBriefSnapshotSchema>;

export function buildOperationSettingsSnapshot(
  input: Readonly<{
    capturedAt?: string;
    config: ProducerConfig;
    profile: PromptProfile;
    runId: string;
  }>,
): OperationSettingsSnapshot {
  const config = producerConfigSchema.parse(input.config);
  const profile = promptProfileSchema.parse(input.profile);
  const body = operationSettingsSnapshotBodySchema.parse({
    schemaVersion: 1,
    operation: "ideas",
    runId: input.runId,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    config,
    configDigest: digest(config),
    profile,
    profileDigest: promptProfileDigest(profile),
  });
  return operationSettingsSnapshotSchema.parse({ ...body, digest: digest(body) });
}

export function buildEpisodeBriefSnapshot(
  input: Readonly<{
    createdAt?: string;
    request: EpisodeCreationRequest;
    settings: OperationSettingsSnapshot;
  }>,
): EpisodeBriefSnapshot {
  const request = episodeCreationRequestSchema.parse(input.request);
  const settings = operationSettingsSnapshotSchema.parse(input.settings);
  if (
    request.profileId !== settings.profile.id ||
    request.expectedProfileDigest !== settings.profileDigest ||
    request.expectedSettingsDigest !== settings.configDigest
  ) {
    throw new SafeExitError(
      "Episode brief settings or profile changed before the operation snapshot was captured.",
    );
  }
  const body = episodeBriefSnapshotBodySchema.parse({
    schemaVersion: 1,
    runId: settings.runId,
    createdAt: input.createdAt ?? settings.capturedAt,
    profileId: request.profileId,
    profileDigest: settings.profileDigest,
    ...(request.operatorBrief ? { operatorBrief: request.operatorBrief } : {}),
    operationSettingsDigest: settings.digest,
  });
  return episodeBriefSnapshotSchema.parse({ ...body, digest: digest(body) });
}

export function operationSettingsSnapshotDigest(
  snapshot: Omit<OperationSettingsSnapshot, "digest">,
): string {
  return digest(operationSettingsSnapshotBodySchema.parse(snapshot));
}

export function episodeBriefSnapshotDigest(snapshot: Omit<EpisodeBriefSnapshot, "digest">): string {
  return digest(episodeBriefSnapshotBodySchema.parse(snapshot));
}

function digest(value: unknown): string {
  return canonicalJsonDigest(value, {
    nonFiniteNumber: "Episode snapshot cannot contain a non-finite number.",
    unsupportedValue: "Episode snapshot contains an unsupported value.",
  });
}
