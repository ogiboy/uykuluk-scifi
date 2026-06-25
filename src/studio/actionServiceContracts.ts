import { z } from "zod";

const RUN_ID_PATTERN = /^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/;

const runIdSchema = z.string().regex(RUN_ID_PATTERN, {
  message: "Invalid run id.",
});

const ideaApprovalRequestSchema = z.strictObject({
  ideaId: z.string().min(1),
  runId: runIdSchema,
});

const scriptApprovalRequestSchema = z.strictObject({
  acknowledgeWarnings: z.boolean().default(false),
  runId: runIdSchema,
});

const runOnlyRequestSchema = z.strictObject({
  runId: runIdSchema,
});

export const studioMutationActionIds = [
  "idea.approve",
  "script.approve",
  "cost.approve",
  "render.approve",
  "upload.private",
  "publish.schedule",
] as const;

export type StudioMutationActionId = (typeof studioMutationActionIds)[number];

type StudioActionRequestById = {
  "cost.approve": z.infer<typeof runOnlyRequestSchema>;
  "idea.approve": z.infer<typeof ideaApprovalRequestSchema>;
  "publish.schedule": z.infer<typeof runOnlyRequestSchema>;
  "render.approve": z.infer<typeof runOnlyRequestSchema>;
  "script.approve": z.infer<typeof scriptApprovalRequestSchema>;
  "upload.private": z.infer<typeof runOnlyRequestSchema>;
};

type StudioMutationAvailability = "disabled-external" | "ready-for-cli";

export type StudioMutationServiceContract = {
  actionId: StudioMutationActionId;
  availability: StudioMutationAvailability;
  cliCommand: string;
  coreExport: string;
  coreModule: string;
  description: string;
  requiresCsrfProtection: true;
  requiresDurableEvidence: true;
  requiresExplicitApproval: true;
  requestSchema: z.ZodType;
};

export const studioMutationServiceContracts = [
  approvalContract({
    actionId: "idea.approve",
    cliCommand: "pnpm producer approve idea --run <run_id> --idea <idea_id>",
    coreExport: "approveIdea",
    coreModule: "src/stages/approveIdea.ts",
    description: "Approve one generated idea for the current run.",
    requestSchema: ideaApprovalRequestSchema,
  }),
  approvalContract({
    actionId: "script.approve",
    cliCommand: "pnpm producer approve script --run <run_id>",
    coreExport: "approveScript",
    coreModule: "src/stages/approveScript.ts",
    description: "Approve the currently reviewed script digest, optionally acknowledging warnings.",
    requestSchema: scriptApprovalRequestSchema,
  }),
  approvalContract({
    actionId: "cost.approve",
    cliCommand: "pnpm producer approve cost --run <run_id>",
    coreExport: "approvePaidGenerationCost",
    coreModule: "src/stages/approveCost.ts",
    description: "Approve the exact current paid-generation cost quote digest.",
    requestSchema: runOnlyRequestSchema,
  }),
  approvalContract({
    actionId: "render.approve",
    cliCommand: "pnpm producer approve render --run <run_id>",
    coreExport: "approveRender",
    coreModule: "src/stages/approveRender.ts",
    description: "Approve render execution for the current render-plan and voiceover digests.",
    requestSchema: runOnlyRequestSchema,
  }),
  disabledExternalContract({
    actionId: "upload.private",
    cliCommand: "pnpm producer upload private --run <run_id>",
    coreExport: "runPrivateUploadPlaceholder",
    coreModule: "src/youtube/uploadDisabled.ts",
    description:
      "Future private-upload action; currently disabled until upload approval/config exist.",
  }),
  disabledExternalContract({
    actionId: "publish.schedule",
    cliCommand: "pnpm producer publish schedule --run <run_id>",
    coreExport: "runPublishPlaceholder",
    coreModule: "src/youtube/uploadDisabled.ts",
    description: "Future scheduled/public publish action; explicitly out of scope for v1.",
  }),
] as const satisfies readonly StudioMutationServiceContract[];

export type StudioMutationServiceContractId =
  (typeof studioMutationServiceContracts)[number]["actionId"];

export function parseStudioMutationRequest<ActionId extends StudioMutationActionId>(
  actionId: ActionId,
  input: unknown,
): StudioActionRequestById[ActionId] {
  return getStudioMutationServiceContract(actionId).requestSchema.parse(
    input,
  ) as StudioActionRequestById[ActionId];
}

export function getStudioMutationServiceContract(
  actionId: StudioMutationActionId,
): StudioMutationServiceContract {
  const contract = studioMutationServiceContracts.find((item) => item.actionId === actionId);
  if (!contract) {
    throw new Error(`Unknown Studio mutation service contract: ${actionId}`);
  }
  return contract;
}

export function hasStudioMutationServiceContract(actionId: string): boolean {
  return studioMutationServiceContracts.some((item) => item.actionId === actionId);
}

function approvalContract(
  contract: Omit<
    StudioMutationServiceContract,
    | "availability"
    | "requiresCsrfProtection"
    | "requiresDurableEvidence"
    | "requiresExplicitApproval"
  >,
): StudioMutationServiceContract {
  return {
    ...contract,
    availability: "ready-for-cli",
    requiresCsrfProtection: true,
    requiresDurableEvidence: true,
    requiresExplicitApproval: true,
  };
}

function disabledExternalContract(
  contract: Omit<
    StudioMutationServiceContract,
    | "availability"
    | "requiresCsrfProtection"
    | "requiresDurableEvidence"
    | "requiresExplicitApproval"
    | "requestSchema"
  >,
): StudioMutationServiceContract {
  return {
    ...contract,
    availability: "disabled-external",
    requestSchema: runOnlyRequestSchema,
    requiresCsrfProtection: true,
    requiresDurableEvidence: true,
    requiresExplicitApproval: true,
  };
}
