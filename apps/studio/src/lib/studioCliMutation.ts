import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z, ZodError } from "zod";
import { projectRoot } from "./projectRoot";
import { validateStudioMutationRequest } from "./studioMutationSecurity";

type StudioCliMutationActionId =
  | "channel-handoff.decide"
  | "cost.approve"
  | "idea.approve"
  | "render.approve"
  | "render.decide"
  | "script.approve";

type CliResult = Readonly<{
  stderr: string;
  stdout: string;
  status: number;
}>;

const runIdSchema = z.string().regex(/^run_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/, "Invalid run id.");
const ideaApprovalPayloadSchema = z.strictObject({
  ideaId: z.string().min(1),
  runId: runIdSchema,
});
const scriptApprovalPayloadSchema = z.strictObject({
  acknowledgeWarnings: z.boolean().default(false),
  runId: runIdSchema,
});
const runOnlyPayloadSchema = z.strictObject({
  runId: runIdSchema,
});
const renderDecisionPayloadSchema = z.strictObject({
  decision: z.enum(["accepted-for-local-review", "needs-revision", "rejected"]),
  notes: z.string().trim().min(1).max(4_000),
  reviewedBy: z.string().trim().min(1).max(200),
  runId: runIdSchema,
});
const channelHandoffDecisionPayloadSchema = z
  .strictObject({
    decision: z.enum(["accepted-for-manual-channel-prep", "needs-revision", "rejected"]),
    notes: z.string().trim().min(1).max(4_000),
    reviewedBy: z.string().trim().min(1).max(200),
    runId: runIdSchema,
    thumbnailCandidateId: z.string().trim().min(1).max(120).optional(),
  })
  .refine(
    (input) =>
      input.decision !== "accepted-for-manual-channel-prep" || Boolean(input.thumbnailCandidateId),
    {
      message: "Accepted channel handoff decisions require a thumbnail candidate.",
      path: ["thumbnailCandidateId"],
    },
  );

/**
 * Runs a guarded Studio mutation through the canonical producer CLI.
 *
 * The Studio route owns browser boundary checks only. The CLI/core still owns state transitions,
 * approval guards, durable evidence writes, and operator-facing blockers.
 *
 * @param request - The incoming Studio JSON request.
 * @param actionId - The enabled local mutation action.
 * @returns A JSON response with the persisted CLI record or a safe error message.
 */
export async function runStudioCliMutationRoute(
  request: Request,
  actionId: StudioCliMutationActionId,
): Promise<Response> {
  const security = validateStudioMutationRequest(request, actionId);
  if (!security.ok) {
    return jsonError(security.message, security.status);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Studio mutation request body must be valid JSON.", 400);
  }

  try {
    const result = await runProducerCli(cliArgsForAction(actionId, payload));
    if (result.status !== 0) {
      return jsonError(cliErrorMessage(result.stderr), 409);
    }
    return Response.json(
      {
        actionId,
        record: parseCliJson(result.stdout),
        status: "ok",
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(`Studio ${actionId} request is invalid.`, 400);
    }
    return jsonError(error instanceof Error ? error.message : `Studio ${actionId} failed.`, 500);
  }
}

function jsonError(message: string, status: number): Response {
  return Response.json(
    {
      message,
      status: "error",
    },
    { headers: noStoreHeaders(), status },
  );
}

function noStoreHeaders(): HeadersInit {
  return { "cache-control": "no-store" };
}

function cliArgsForAction(actionId: StudioCliMutationActionId, payload: unknown): string[] {
  if (actionId === "idea.approve") {
    const input = ideaApprovalPayloadSchema.parse(payload);
    return ["approve", "idea", "--run", input.runId, "--idea", input.ideaId, "--json"];
  }
  if (actionId === "script.approve") {
    const input = scriptApprovalPayloadSchema.parse(payload);
    return [
      "approve",
      "script",
      "--run",
      input.runId,
      ...(input.acknowledgeWarnings ? ["--acknowledge-warnings"] : []),
      "--json",
    ];
  }
  if (actionId === "cost.approve") {
    const input = runOnlyPayloadSchema.parse(payload);
    return ["approve", "cost", "--run", input.runId, "--json"];
  }
  if (actionId === "render.approve") {
    const input = runOnlyPayloadSchema.parse(payload);
    return ["approve", "render", "--run", input.runId, "--json"];
  }
  if (actionId === "render.decide") {
    const input = renderDecisionPayloadSchema.parse(payload);
    return [
      "decide",
      "render",
      "--run",
      input.runId,
      "--decision",
      input.decision,
      "--notes",
      input.notes,
      "--reviewed-by",
      input.reviewedBy,
      "--json",
    ];
  }
  const input = channelHandoffDecisionPayloadSchema.parse(payload);
  return [
    "decide",
    "channel-handoff",
    "--run",
    input.runId,
    "--decision",
    input.decision,
    ...(input.thumbnailCandidateId ? ["--thumbnail-candidate", input.thumbnailCandidateId] : []),
    "--notes",
    input.notes,
    "--reviewed-by",
    input.reviewedBy,
    "--json",
  ];
}

function runProducerCli(args: readonly string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const sourceRoot = sourceProjectRoot();
    const child = spawn(
      path.join(sourceRoot, "node_modules", ".bin", "tsx"),
      [path.join(sourceRoot, "src", "cli.ts"), ...args],
      {
        cwd: projectRoot(),
        env: process.env,
        shell: false,
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stderr, stdout, status: code ?? 1 });
    });
  });
}

function parseCliJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error("Studio mutation CLI returned invalid JSON.");
  }
}

function cliErrorMessage(stderr: string): string {
  const message = stderr.trim();
  return message || "Studio mutation was blocked by the producer CLI.";
}

function sourceProjectRoot(): string {
  const candidates = [
    process.env.UYKULUK_SCIFI_SOURCE_ROOT,
    findSourceRootFromModule(),
    projectRoot(),
  ];
  for (const candidate of candidates) {
    if (candidate && isSourceProjectRoot(candidate)) {
      return candidate;
    }
  }
  return projectRoot();
}

function findSourceRootFromModule(): string | null {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (isSourceProjectRoot(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function isSourceProjectRoot(candidate: string): boolean {
  return (
    existsSync(path.join(candidate, "src", "cli.ts")) &&
    existsSync(path.join(candidate, "apps", "studio", "package.json"))
  );
}
