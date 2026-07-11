import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { initProject } from "../src/config/config";

let previousCwd = process.cwd();
let currentDir: string | undefined;

export function useTempProject(): void {
  beforeEach(async () => {
    previousCwd = process.cwd();
    currentDir = await mkdtemp(path.join(tmpdir(), "uykulukscifi-producer-"));
    process.chdir(currentDir);
    await mkdir("runs", { recursive: true });
    await initProject();
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    if (currentDir) {
      await rm(currentDir, { recursive: true, force: true });
    }
    currentDir = undefined;
  });
}
