import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readProductionPackagePopupCards } from "../src/stages/production/productionPackageMarkdown";
import { useTempProject } from "./helpers";

describe("production package markdown helpers", () => {
  useTempProject();

  it("reads only popup-card bullets from the production package section", async () => {
    const runId = "run_20260701_000001";
    await mkdir(`runs/${runId}/production`, { recursive: true });
    await writeFile(
      `runs/${runId}/production/production_package.md`,
      [
        "# Production Package",
        "",
        "## Popup Cards",
        "",
        "- İlk kart",
        "- İkinci kart",
        "",
        "## Lower Thirds",
        "",
        "- Alt bant",
      ].join("\n"),
      "utf8",
    );

    await expect(readProductionPackagePopupCards(runId)).resolves.toEqual([
      "İlk kart",
      "İkinci kart",
    ]);
  });
});
