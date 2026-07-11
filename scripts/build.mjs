import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

const tsc = process.platform === "win32" ? "tsc.cmd" : "tsc";
const result = spawnSync(tsc, ["-p", "tsconfig.build.json"], {
  stdio: "inherit",
  env: process.env,
});

process.exitCode = result.status ?? 1;
