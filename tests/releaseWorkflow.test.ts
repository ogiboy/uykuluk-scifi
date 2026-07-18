import { readFileSync } from "node:fs";

describe("release workflow", () => {
  it("publishes releases through a stale-checkout tolerant helper", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const helper = readFileSync("scripts/release/apply-and-push-release.sh", "utf8");

    expect(workflow).toContain("scripts/release/apply-and-push-release.sh");
    expect(helper).toContain('git reset --hard "origin/${branch}"');
    expect(helper).toContain("git push --atomic");
    expect(helper).toContain("RELEASE_PUSH_MAX_ATTEMPTS");
    expect(helper).toContain("RELEASE_EXPECTED_SHA");
    expect(helper).toContain("Release is superseded");
  });

  it("waits for the CircleCI main quality gate before the main-only publish boundary", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("statuses: read");
    expect(workflow).toContain("github.actor != 'github-actions[bot]'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("id: circleci_quality");
    expect(workflow).toContain('QUALITY_CONTEXT: "ci/circleci: quality-gate"');
    expect(workflow).toContain('main_sha="${GITHUB_SHA}"');
    expect(workflow).toContain("/commits/${main_sha}/statuses?per_page=100");
    expect(workflow).not.toContain("/commits/main");
    expect(workflow).toContain("Timed out waiting for CircleCI quality gate");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).not.toContain("pnpm check");
    expect(workflow).not.toContain("pnpm security:dependencies");
    expect(workflow).not.toContain("pnpm qa:usage");
    expect(workflow).not.toContain("pnpm release:check");
    expect(workflow).toContain("RELEASE_EXPECTED_SHA: ${{ steps.circleci_quality.outputs.sha }}");
    expect(workflow).toContain("scripts/release/apply-and-push-release.sh");
    expect(pkg.scripts?.["version:plan"]).toBe("tsx scripts/release/version-plan.ts");
    expect(pkg.scripts?.["release:apply"]).toBe("tsx scripts/release/apply-release.ts");
  });

  it("keeps the release helper tied to version planning, release application, and atomic tags", () => {
    const helper = readFileSync("scripts/release/apply-and-push-release.sh", "utf8");

    expect(helper).toContain("pnpm --silent version:plan");
    expect(helper).toContain("pnpm release:apply");
    expect(helper).toContain('git commit -m "chore(release): ${tag}"');
    expect(helper).toContain('git tag -a "${tag}" -m "chore(release): ${tag}"');
    expect(helper).toContain('git push --atomic origin "HEAD:${branch}" "refs/tags/${tag}"');
    expect(helper).toContain('git tag -d "${tag}"');
  });
});
