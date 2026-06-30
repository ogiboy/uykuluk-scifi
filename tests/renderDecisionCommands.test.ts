import { describe, expect, it } from "vitest";
import {
  renderDecisionCommandTemplates,
  renderDecisionJsonPath,
  renderDecisionMarkdownPath,
} from "../src/stages/renderDecisionCommands";

describe("render decision command templates", () => {
  it("builds bundle-safe local decision command templates", () => {
    const commands = renderDecisionCommandTemplates("run_template");

    expect(commands).toEqual([
      {
        command:
          "pnpm producer decide render --run run_template --decision accepted-for-local-review --notes '<operator notes>' --reviewed-by operator",
        decision: "accepted-for-local-review",
        guidance: expect.stringContaining("complete local draft"),
      },
      {
        command:
          "pnpm producer decide render --run run_template --decision needs-revision --notes '<operator notes>' --reviewed-by operator",
        decision: "needs-revision",
        guidance: expect.stringContaining("another pass"),
      },
      {
        command:
          "pnpm producer decide render --run run_template --decision rejected --notes '<operator notes>' --reviewed-by operator",
        decision: "rejected",
        guidance: expect.stringContaining("should not be used"),
      },
    ]);
    expect(renderDecisionJsonPath).toBe("production/render/render_decision.json");
    expect(renderDecisionMarkdownPath).toBe("production/render/render_decision.md");
  });
});
