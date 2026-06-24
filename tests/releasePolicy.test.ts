import {
  buildReleasePlan,
  parseConventionalSubject,
  renderCommitReleaseNotes,
  updateChangelog,
  type GitCommit,
} from "../scripts/release/releasePolicy.js";

function commit(hash: string, subject: string, parents: string[] = ["parent"]): GitCommit {
  return { hash, parents, subject };
}

describe("release policy", () => {
  it("computes a minor bump for features and ignores release, merge, and legacy commits", () => {
    const plan = buildReleasePlan({
      currentVersion: "0.1.0",
      latestTag: null,
      commits: [
        commit("a".repeat(40), "fix(core): tighten guard"),
        commit("b".repeat(40), "feat(render): add render plan"),
        commit("c".repeat(40), "chore(release): v0.1.1"),
        commit("d".repeat(40), "Merge pull request #1", ["p1", "p2"]),
        commit(
          "e".repeat(40),
          "Merge cac2786e3d91f707d82c60de92bc114fcae92154 into 29aa2650a0319e0831f53197b2f5bfcc869566d1",
        ),
        commit(
          "ec58978101438e9c02b548d92ac4d1a3e7aceadf",
          "📝 Add docstrings to `fix/core-script-approval-integrity`",
        ),
      ],
    });

    expect(plan.releaseNeeded).toBe(true);
    expect(plan.bump).toBe("minor");
    expect(plan.nextVersion).toBe("0.2.0");
    expect(plan.invalidCommits).toEqual([]);
    expect(plan.ignoredCommits).toHaveLength(4);
  });

  it("reports invalid release-range commit subjects", () => {
    const plan = buildReleasePlan({
      currentVersion: "0.1.0",
      latestTag: "v0.1.0",
      commits: [commit("f".repeat(40), "Update stuff")],
    });

    expect(plan.releaseNeeded).toBe(false);
    expect(plan.invalidCommits.map((entry) => entry.subject)).toEqual(["Update stuff"]);
  });

  it("parses breaking zero-major changes as a minor release", () => {
    const parsed = parseConventionalSubject(
      commit("1".repeat(40), "feat(core)!: change state file"),
    );
    expect(parsed?.breaking).toBe(true);

    const plan = buildReleasePlan({
      currentVersion: "0.2.3",
      latestTag: "v0.2.3",
      commits: [commit("1".repeat(40), "feat(core)!: change state file")],
    });

    expect(plan.bump).toBe("major");
    expect(plan.nextVersion).toBe("0.3.0");
  });

  it("moves curated Unreleased notes into the new version section", () => {
    const changelog = [
      "# Changelog",
      "",
      "<!-- version list -->",
      "",
      "## Unreleased",
      "",
      "### Added",
      "",
      "- Render planning docs.",
      "",
      "## 0.1.0 - 2026-06-17",
      "",
      "### Added",
      "",
      "- Initial release.",
      "",
    ].join("\n");

    const next = updateChangelog(changelog, "0.2.0", "2026-06-24", []);

    expect(next).toContain("## Unreleased\n\n_No unreleased changes yet._");
    expect(next).toContain("## v0.2.0 (2026-06-24)\n\n### Added\n\n- Render planning docs.");
    expect(next).toContain("## 0.1.0 - 2026-06-17");
  });

  it("generates changelog notes from commits when Unreleased is empty", () => {
    const notes = renderCommitReleaseNotes([
      {
        ...commit("2".repeat(40), "docs(readme): clarify release workflow"),
        breaking: false,
        description: "clarify release workflow",
        scope: "readme",
        type: "docs",
      },
    ]);

    expect(notes).toBe("### Documentation\n\n- clarify release workflow (2222222)");
  });
});
