import { describe, expect, it } from "vitest";
import { resolveStatusRunId } from "../src/cli/statusRunSelector";

describe("status run selector", () => {
  it("uses an explicit run id", async () => {
    await expect(resolveStatusRunId({ run: "run_20260627120000_abcd12" })).resolves.toBe(
      "run_20260627120000_abcd12",
    );
  });

  it("selects the first listed run when latest is requested", async () => {
    await expect(
      resolveStatusRunId({ latest: true }, async () => [
        { runId: "run_20260627120100_latest" },
        { runId: "run_20260627120000_older" },
      ]),
    ).resolves.toBe("run_20260627120100_latest");
  });

  it("fails closed when the selector is missing, duplicated, or empty", async () => {
    await expect(resolveStatusRunId({})).rejects.toThrow("Provide --run <run_id> or --latest.");
    await expect(
      resolveStatusRunId({ latest: true, run: "run_20260627120000_abcd12" }),
    ).rejects.toThrow("Use either --run <run_id> or --latest, not both.");
    await expect(resolveStatusRunId({ latest: true }, async () => [])).rejects.toThrow(
      "No runs found. Start with pnpm producer ideas.",
    );
  });
});
