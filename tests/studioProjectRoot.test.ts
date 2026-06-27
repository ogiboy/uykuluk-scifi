import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectRoot } from "../apps/studio/src/lib/projectRoot";

const originalCwd = process.cwd();
const originalRootOverride = process.env.UYKULUK_SCIFI_ROOT;

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalRootOverride === undefined) {
    delete process.env.UYKULUK_SCIFI_ROOT;
  } else {
    process.env.UYKULUK_SCIFI_ROOT = originalRootOverride;
  }
  await rm(path.join(originalCwd, ".tmp-studio-project-root-test"), {
    force: true,
    recursive: true,
  });
});

describe("Studio project root", () => {
  it("uses the explicit root override before cwd detection", () => {
    process.env.UYKULUK_SCIFI_ROOT = "/operator/selected/root";

    expect(projectRoot()).toBe("/operator/selected/root");
  });

  it("resolves the repository root from a nested apps/studio cwd", async () => {
    delete process.env.UYKULUK_SCIFI_ROOT;
    const repo = path.join(originalCwd, ".tmp-studio-project-root-test");
    const nestedStudioPath = path.join(repo, "apps", "studio", "src");
    await mkdir(nestedStudioPath, { recursive: true });
    await writeFile(path.join(repo, "package.json"), "{}\n", "utf8");
    await writeFile(path.join(repo, "apps", "studio", "package.json"), "{}\n", "utf8");
    process.chdir(nestedStudioPath);

    expect(projectRoot()).toBe(repo);
  });
});
