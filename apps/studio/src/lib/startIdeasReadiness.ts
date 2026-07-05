import type { StudioDoctorOverview } from "./doctorOverview";

export type StartIdeasReadinessTone = "blocked" | "neutral" | "ready" | "warning";

export type StartIdeasReadinessSummary = Readonly<{
  detail: string;
  label: string;
  nextAction: string | null;
  tone: StartIdeasReadinessTone;
}>;

type StartIdeasDoctorInput = Pick<
  StudioDoctorOverview,
  "blockCount" | "error" | "nextAction" | "status" | "warnCount"
>;

/**
 * Projects persisted doctor diagnostics into concise idea-generation guidance for Studio.
 *
 * This is display-only. The guarded action still calls CLI/core, which re-checks provider,
 * budget, parser, evidence, and failure guards before writing any run artifacts.
 *
 * @param doctor - Latest read-only Studio doctor overview.
 * @returns Operator-facing readiness context for starting an idea run.
 */
export function startIdeasReadinessFromDoctor(
  doctor: StartIdeasDoctorInput,
): StartIdeasReadinessSummary {
  if (doctor.status === "passing") {
    return {
      detail:
        "Latest doctor snapshot passes. CLI/core will still re-check provider, budget, and parser guards.",
      label: "Doctor ready",
      nextAction: null,
      tone: "ready",
    };
  }
  if (doctor.status === "warning") {
    return {
      detail: `${doctor.warnCount} warning(s) in the latest doctor snapshot. Idea generation remains guarded and may still proceed if CLI/core allows it.`,
      label: "Doctor warnings",
      nextAction: doctor.nextAction,
      tone: "warning",
    };
  }
  if (doctor.status === "blocked") {
    return {
      detail: `${doctor.blockCount} blocking doctor check(s). Idea generation may fail until the local provider/config remediation is handled.`,
      label: "Doctor blocked",
      nextAction: doctor.nextAction,
      tone: "blocked",
    };
  }
  return {
    detail: doctor.error ?? "Run producer doctor before relying on local provider readiness.",
    label: doctor.status === "invalid" ? "Doctor invalid" : "Doctor missing",
    nextAction: doctor.nextAction,
    tone: "neutral",
  };
}
