import { spawnSync } from "node:child_process";
import path from "node:path";

const sourceRoot = process.cwd();

export type ProducerCliTestResult = Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

export type ProducerCliTestOptions = Readonly<{
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
}>;

/** Runs the TypeScript producer CLI without the tsx IPC service. */
export function runProducerCliForTest(
  args: readonly string[],
  options: ProducerCliTestOptions = {},
): ProducerCliTestResult {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      path.join(sourceRoot, "node_modules", "tsx", "dist", "loader.mjs"),
      path.join(sourceRoot, "src", "cli.ts"),
      ...args,
    ],
    {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      env: options.env,
      timeout: options.timeout,
    },
  );

  return {
    status: result.status,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}
