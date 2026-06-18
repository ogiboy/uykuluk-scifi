import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { readLedger } from "../src/core/ledger";
import { createRun } from "../src/core/runStore";
import { ApprovalRecord, ApprovalTarget, RunRecord } from "../src/core/state";
import { runPrivateUploadPlaceholder, runPublishPlaceholder } from "../src/youtube/uploadDisabled";
import { useTempProject } from "./helpers";

describe("publish safeguards", () => {
  useTempProject();

  it("blocks private upload by default even with explicit approval", async () => {
    const run = withApproval(await createRun(), "upload");

    await expect(runPrivateUploadPlaceholder(run, defaultConfig)).rejects.toThrow(
      /Upload is disabled by default/,
    );
    expect(
      (await readLedger(run.runId)).some(
        (event) => event.stage === "upload" && event.type === "GUARD_BLOCKED",
      ),
    ).toBe(true);
  });

  it("keeps private upload scaffolded after approval and explicit config", async () => {
    const run = withApproval(await createRun(), "upload");
    const config = {
      ...defaultConfig,
      providers: {
        ...defaultConfig.providers,
        youtube: {
          enabled: true,
          allowPrivateUpload: true,
          allowPublicPublish: false,
        },
      },
    };

    await expect(runPrivateUploadPlaceholder(run, config)).rejects.toThrow(
      /implementation is intentionally disabled/,
    );
  });

  it("requires publish approval even when public config is enabled", async () => {
    const run = await createRun();
    const config = publicPublishConfig();

    await expect(runPublishPlaceholder(run, config)).rejects.toThrow(
      /requires explicit publish approval/,
    );
  });

  it("keeps public publish scaffolded after approval and explicit config", async () => {
    const run = withApproval(await createRun(), "publish");

    await expect(runPublishPlaceholder(run, publicPublishConfig())).rejects.toThrow(
      /implementation is intentionally disabled/,
    );
  });
});

function withApproval(run: RunRecord, target: ApprovalTarget): RunRecord {
  const approval: ApprovalRecord = {
    approvalId: `approval_${target}`,
    runId: run.runId,
    target,
    previousState: run.state,
    nextState: run.state,
    approvingCommand: `producer approve ${target}`,
    createdAt: new Date().toISOString(),
  };
  return { ...run, approvals: [...run.approvals, approval] };
}

function publicPublishConfig() {
  return {
    ...defaultConfig,
    providers: {
      ...defaultConfig.providers,
      youtube: {
        enabled: true,
        allowPrivateUpload: true,
        allowPublicPublish: true,
      },
    },
  };
}
