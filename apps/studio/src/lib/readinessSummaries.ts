export type StudioReadinessCheck = {
  message: string;
  name: string;
  nextAction?: string;
  status: "block" | "pass" | "warn";
};

export type ReadinessSnapshot = {
  checks?: unknown[];
  passed?: boolean;
};

export function summarizeReadinessChecks(
  readiness: ReadinessSnapshot | null,
): StudioReadinessCheck[] {
  if (!Array.isArray(readiness?.checks)) {
    return [];
  }
  return readiness.checks.flatMap((check) => summarizeReadinessCheck(check));
}

function summarizeReadinessCheck(check: unknown): StudioReadinessCheck[] {
  if (!check || typeof check !== "object") {
    return [];
  }
  const name = "name" in check ? check.name : undefined;
  const status = "status" in check ? check.status : undefined;
  const message = "message" in check ? check.message : undefined;
  const nextAction = "nextAction" in check ? check.nextAction : undefined;
  return typeof name === "string" && isReadinessStatus(status) && typeof message === "string"
    ? [readinessCheck({ message, name, nextAction, status })]
    : [];
}

function readinessCheck(input: {
  message: string;
  name: string;
  nextAction: unknown;
  status: StudioReadinessCheck["status"];
}): StudioReadinessCheck {
  return typeof input.nextAction === "string"
    ? {
        message: input.message,
        name: input.name,
        nextAction: input.nextAction,
        status: input.status,
      }
    : {
        message: input.message,
        name: input.name,
        status: input.status,
      };
}

function isReadinessStatus(value: unknown): value is StudioReadinessCheck["status"] {
  return value === "block" || value === "pass" || value === "warn";
}
