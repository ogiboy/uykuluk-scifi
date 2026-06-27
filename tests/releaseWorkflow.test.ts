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

  it("keeps main-only release validation and publish boundaries intact", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("github.actor != 'github-actions[bot]'");
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm security:dependencies");
    expect(workflow).toContain("pnpm qa:usage");
    expect(workflow).toContain("pnpm release:check");
    expect(workflow).toContain("scripts/release/apply-and-push-release.sh");
    expect(pkg.scripts?.["security:dependencies"]).toBe("pnpm audit --audit-level=high");
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
