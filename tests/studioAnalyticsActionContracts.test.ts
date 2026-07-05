import { describe, expect, it } from "vitest";
import {
  getStudioMutationServiceContract,
  parseStudioMutationRequest,
} from "../src/studio/actionServiceContracts";

describe("Studio analytics mutation contracts", () => {
  it("binds analytics import and report actions to local CLI/core contracts", () => {
    expect(getStudioMutationServiceContract("analytics.import")).toMatchObject({
      actionId: "analytics.import",
      availability: "ready-for-cli",
      coreExport: "importAnalyticsFile",
      coreModule: "src/analytics/import.ts",
    });
    expect(getStudioMutationServiceContract("analytics.report")).toMatchObject({
      actionId: "analytics.report",
      availability: "ready-for-cli",
      coreExport: "refreshSavedAnalyticsReport",
      coreModule: "src/analytics/import.ts",
    });
  });

  it("parses bounded operator-provided analytics import payloads", () => {
    expect(
      parseStudioMutationRequest("analytics.import", {
        content: "video_id,title,views\nyt_001,Test,10\n",
        format: "csv",
        sourceFileName: "performance.csv",
      }),
    ).toEqual({
      content: "video_id,title,views\nyt_001,Test,10\n",
      format: "csv",
      sourceFileName: "performance.csv",
    });
    expect(parseStudioMutationRequest("analytics.report", {})).toEqual({});
  });

  it("rejects path-like or ambiguous analytics import payloads", () => {
    expect(() =>
      parseStudioMutationRequest("analytics.import", {
        content: "video_id,title,views\nyt_001,Test,10\n",
        format: "csv",
        sourceFileName: "../performance.csv",
      }),
    ).toThrow(/path separators/);
    expect(() =>
      parseStudioMutationRequest("analytics.import", {
        content: "video_id,title,views\nyt_001,Test,10\n",
        extra: true,
        format: "csv",
        sourceFileName: "performance.csv",
      }),
    ).toThrow(/Unrecognized key/);
  });
});
