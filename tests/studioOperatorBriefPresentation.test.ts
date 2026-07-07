import { describe, expect, it } from "vitest";
import {
  operatorBriefControlForAction,
  operatorBriefToneLabel,
} from "../apps/studio/src/lib/operatorBriefPresentation";
import type { StudioRunPrimaryAction } from "../apps/studio/src/lib/runPrimaryAction";

describe("Studio operator brief presentation", () => {
  it("keeps guarded stage actions on the web control path even when a CLI command exists", () => {
    expect(
      operatorBriefControlForAction(
        actionFixture({
          command: "pnpm producer render-plan --run run_operator_brief",
          mode: "stage",
          routePath: "/actions/run-render-plan",
          tone: "available",
        }),
      ),
    ).toBe("stage-button");
  });

  it("routes action rail work separately from CLI-only commands", () => {
    expect(operatorBriefControlForAction(actionFixture({ mode: "rail" }))).toBe(
      "run-controls-link",
    );
    expect(
      operatorBriefControlForAction(
        actionFixture({
          command: "pnpm producer manual-check --run run_operator_brief",
          mode: "command",
          routePath: null,
          tone: "cli-only",
        }),
      ),
    ).toBe("copy-command");
  });

  it("formats compact safety tone labels", () => {
    expect(operatorBriefToneLabel("available")).toBe("web-ready");
    expect(operatorBriefToneLabel("blocked")).toBe("blocked");
    expect(operatorBriefToneLabel("cli-only")).toBe("CLI-only");
    expect(operatorBriefToneLabel("complete")).toBe("complete");
  });
});

function actionFixture(overrides: Partial<StudioRunPrimaryAction> = {}): StudioRunPrimaryAction {
  return {
    command: null,
    description: "Operator brief test action.",
    label: "Open run controls",
    mode: "rail",
    routePath: "/actions/approve-script",
    tone: "available",
    ...overrides,
  };
}
