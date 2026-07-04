import { describe, expect, it } from "vitest";
import { startIdeasReadinessFromDoctor } from "../apps/studio/src/lib/startIdeasReadiness";

describe("Studio start ideas readiness", () => {
  it("keeps passing doctor output as guidance without creating a web-side gate", () => {
    expect(
      startIdeasReadinessFromDoctor({
        blockCount: 0,
        error: null,
        nextAction: "pnpm producer doctor",
        status: "passing",
        warnCount: 0,
      }),
    ).toEqual({
      detail:
        "Latest doctor snapshot passes. CLI/core will still re-check provider, budget, and parser guards.",
      label: "Doctor ready",
      nextAction: null,
      tone: "ready",
    });
  });

  it("surfaces blocked provider or config remediation before the operator starts ideas", () => {
    expect(
      startIdeasReadinessFromDoctor({
        blockCount: 1,
        error: null,
        nextAction: "Start llama-server with the configured local GGUF model.",
        status: "blocked",
        warnCount: 0,
      }),
    ).toEqual({
      detail:
        "1 blocking doctor check(s). Idea generation may fail until the local provider/config remediation is handled.",
      label: "Doctor blocked",
      nextAction: "Start llama-server with the configured local GGUF model.",
      tone: "blocked",
    });
  });

  it("handles missing or invalid doctor snapshots as operator guidance", () => {
    expect(
      startIdeasReadinessFromDoctor({
        blockCount: 0,
        error: null,
        nextAction: "pnpm producer doctor",
        status: "missing",
        warnCount: 0,
      }),
    ).toMatchObject({
      label: "Doctor missing",
      nextAction: "pnpm producer doctor",
      tone: "neutral",
    });
    expect(
      startIdeasReadinessFromDoctor({
        blockCount: 0,
        error: "diagnostics/doctor.json contains malformed JSON or a truncated write.",
        nextAction: "pnpm producer doctor",
        status: "invalid",
        warnCount: 0,
      }),
    ).toMatchObject({
      detail: "diagnostics/doctor.json contains malformed JSON or a truncated write.",
      label: "Doctor invalid",
      tone: "neutral",
    });
  });
});
