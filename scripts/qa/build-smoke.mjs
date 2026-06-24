import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workdir = await mkdtemp(path.join(tmpdir(), "uykulukscifi-build-smoke-"));

try {
  await assertMissing("dist/src");
  await assertMissing("dist/tests");
  run(["node", "dist/cli.js", "--help"], { cwd: process.cwd(), expectOutput: "producer" });
  run(["node", path.resolve("dist/cli.js"), "init"], {
    cwd: workdir,
    expectOutput: "Initialized project.",
  });
} finally {
  await rm(workdir, { recursive: true, force: true });
}

async function assertMissing(relativePath) {
  try {
    await stat(relativePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Build smoke failed: unexpected build artifact exists: ${relativePath}`);
}

function run(args, options) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: options.cwd,
    encoding: "utf8",
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0 || !output.includes(options.expectOutput)) {
    throw new Error(`Build smoke failed: ${args.join(" ")}\n${output}`);
  }
}
