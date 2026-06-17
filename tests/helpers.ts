import { mkdtemp, cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, afterEach } from "vitest";
import { initProject } from "../src/config/config";

let previousCwd = process.cwd();
let currentDir: string | undefined;

export function useTempProject(): void {
  beforeEach(async () => {
    previousCwd = process.cwd();
    currentDir = await mkdtemp(path.join(tmpdir(), "uykulukscifi-producer-"));
    process.chdir(currentDir);
    await mkdir("runs", { recursive: true });
    await cp(
      path.join(previousCwd, "producer.config.example.json"),
      path.join(currentDir, "producer.config.example.json"),
    );
    await mkdir(".ai/prompts", { recursive: true });
    await mkdir(".ai/runbooks", { recursive: true });
    await mkdir(".ai/checklists", { recursive: true });
    await mkdir(".ai/reviews", { recursive: true });
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
