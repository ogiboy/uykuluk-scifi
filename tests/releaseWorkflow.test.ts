import { readFileSync } from "node:fs";

describe("release workflow", () => {
  it("publishes releases through a stale-checkout tolerant helper", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const helper = readFileSync("scripts/release/apply-and-push-release.sh", "utf8");

    expect(workflow).toContain("scripts/release/apply-and-push-release.sh");
    expect(helper).toContain('git reset --hard "origin/${branch}"');
    expect(helper).toContain("git push --atomic");
    expect(helper).toContain("RELEASE_PUSH_MAX_ATTEMPTS");
  });
});
