import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { projectRoot } from "../../../lib/projectRoot";
import { validateStudioMutationRequest } from "../../../lib/studioMutationSecurity";
import { parseStudioMutationRequest } from "../../../../../../src/studio/actionServiceContracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RenderDecisionRequest = ReturnType<typeof parseRenderDecisionRequest>;

type CliResult = Readonly<{
  stderr: string;
  stdout: string;
  status: number;
}>;

/**
 * Records the local draft-render decision through the shared CLI/core contract.
 *
 * @param request - The Studio JSON mutation request.
 * @returns A JSON response with the persisted render decision, or a safe error message.
 */
export async function POST(request: Request): Promise<Response> {
  const security = validateStudioMutationRequest(request, "render.decide");
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
    const input = parseRenderDecisionRequest(payload);
    const result = await runRenderDecisionCli(input);
    if (result.status !== 0) {
      return jsonError(cliErrorMessage(result.stderr), 409);
    }
    return Response.json({
      actionId: "render.decide",
      record: parseCliJson(result.stdout),
      status: "ok",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Studio render decision request is invalid.", 400);
    }
    return jsonError(
      error instanceof Error ? error.message : "Studio render decision failed.",
      500,
    );
  }
}

function jsonError(message: string, status: number): Response {
  return Response.json(
    {
      message,
      status: "error",
    },
    { status },
  );
}

function parseRenderDecisionRequest(payload: unknown) {
  return parseStudioMutationRequest("render.decide", payload);
}

/**
 * Runs the fixed render-decision CLI command with argv-only operator input.
 *
 * @param input - The validated render-decision request.
 * @returns The captured CLI exit status and output streams.
 */
function runRenderDecisionCli(input: RenderDecisionRequest): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const sourceRoot = sourceProjectRoot();
    const child = spawn(
      path.join(sourceRoot, "node_modules", ".bin", "tsx"),
      [
        path.join(sourceRoot, "src", "cli.ts"),
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
      ],
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
    throw new Error("Studio render decision CLI returned invalid JSON.");
  }
}

function cliErrorMessage(stderr: string): string {
  const message = stderr.trim();
  return message || "Studio render decision was blocked by the producer CLI.";
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
