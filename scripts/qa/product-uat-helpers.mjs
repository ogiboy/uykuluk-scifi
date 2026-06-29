import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Copies the repository into an isolated ignored workdir.
 *
 * @param {Object} options - Workspace options.
 * @param {string} options.repoRoot - Source repository root.
 * @param {string} options.workdir - Destination workdir.
 */
export async function prepareWorkspace({ repoRoot, workdir }) {
  await cp(repoRoot, workdir, {
    filter: (source) => {
      const relative = path.relative(repoRoot, source);
      if (!relative) return true;
      return !(
        relative === ".git" ||
        relative.startsWith(`.git${path.sep}`) ||
        relative === "node_modules" ||
        relative.startsWith(`node_modules${path.sep}`) ||
        relative === "runs" ||
        relative.startsWith(`runs${path.sep}`) ||
        relative === "producer.config.json" ||
        relative.startsWith(`.ai${path.sep}qa${path.sep}artifacts`)
      );
    },
    recursive: true,
  });
}

/**
 * Enables deterministic local TTS in the isolated config.
 *
 * @param {Object} options - TTS setup options.
 * @param {string} options.workdir - Isolated workdir containing producer.config.json.
 */
export async function enableDeterministicTts({ workdir }) {
  const target = path.join(workdir, "producer.config.json");
  const config = JSON.parse(await readFile(target, "utf8"));
  config.providers.tts = { enabled: true, mode: "deterministic-local" };
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Creates fake ffmpeg and ffprobe binaries for local product UAT.
 *
 * @param {Object} options - Media tool options.
 * @param {string} options.workdir - Isolated workdir where binaries are written.
 * @returns {Promise<{binDir: string}>} Directory containing executable fake media tools.
 */
export async function createFakeMediaTools({ workdir }) {
  const binDir = path.join(workdir, "fake-bin");
  await mkdir(binDir, { recursive: true });
  const ffmpeg = path.join(binDir, "ffmpeg");
  const ffprobe = path.join(binDir, "ffprobe");
  await writeFile(
    ffmpeg,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const output = process.argv.at(-1);",
      'writeFileSync(output, Buffer.from(`fake mp4\\n${process.argv.slice(2).join("\\n")}`));',
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    ffprobe,
    [
      "#!/usr/bin/env node",
      "console.log(JSON.stringify({",
      "  format: { duration: '8.000000', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },",
      "  streams: [",
      "    { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, duration: '8.000000' },",
      "    { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, duration: '8.000000' }",
      "  ]",
      "}));",
    ].join("\n"),
    "utf8",
  );
  await chmod(ffmpeg, 0o755);
  await chmod(ffprobe, 0o755);
  return { binDir };
}

/**
 * Runs a CLI command and records the result as a report step.
 *
 * @param {Object} input - Command input.
 * @param {string[]} input.args - Command and arguments.
 * @param {Object} input.options - Step options.
 * @param {Object} [input.options.env] - Environment overrides.
 * @param {boolean} [input.options.expectFailure=false] - Whether the command should fail.
 * @param {string} [input.options.expectOutput] - Required output substring.
 * @param {string} input.options.label - Step label.
 * @param {string} input.options.scenario - Scenario label.
 * @param {Array<Object>} input.steps - Mutable report step list.
 * @param {string} input.workdir - Spawn working directory.
 * @returns {{stdout: string, stderr: string}} Captured output.
 */
export function runProductCommand({ args, options, steps, workdir }) {
  const { env, expectFailure = false, expectOutput, label, scenario } = options;
  const result = spawnSync(args[0], args.slice(1), {
    cwd: workdir,
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const passedExit = expectFailure ? result.status !== 0 : result.status === 0;
  const passedOutput = expectOutput ? output.includes(expectOutput) : true;
  const passed = passedExit && passedOutput;
  steps.push({
    command: args.join(" "),
    expectFailure,
    expectOutput,
    label,
    output: output.trim().slice(-8_000),
    passed,
    scenario,
    status: result.status,
  });
  if (!passed) {
    throw new Error(`Product UAT step failed: ${scenario} / ${label}\n${output}`);
  }
  return { stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
}

/**
 * Extracts the created run id from CLI output.
 *
 * @param {string} output - CLI stdout.
 * @returns {string} Run id.
 */
export function extractRunId(output) {
  const match = /Run created:\s+(run_[^\s]+)/.exec(output);
  if (!match) {
    throw new Error(`Could not extract run id from output:\n${output}`);
  }
  return match[1];
}

/**
 * Verifies an expected file exists in the isolated workdir.
 *
 * @param {Object} input - Assertion input.
 * @param {string} input.label - Report label.
 * @param {string} input.relativePath - File path relative to the workdir.
 * @param {Array<Object>} input.steps - Mutable report step list.
 * @param {string} input.workdir - Isolated workdir.
 */
export async function assertProductFile({ label, relativePath, steps, workdir }) {
  const target = path.join(workdir, relativePath);
  const exists = existsSync(target);
  const isFile = exists ? (await stat(target)).isFile() : false;
  steps.push({
    command: "assert",
    label,
    output: "",
    passed: isFile,
    scenario: "artifact verification",
    status: isFile ? 0 : 1,
  });
  if (!isFile) {
    throw new Error(`Missing expected file: ${relativePath}`);
  }
}

/**
 * Writes JSON and Markdown UAT reports.
 *
 * @param {Object} input - Report input.
 * @param {string} input.reportDir - Destination report directory.
 * @param {Date} input.startedAt - UAT start time.
 * @param {Array<Object>} input.steps - Report steps.
 * @param {Object} input.summary - Summary fields.
 */
export async function writeProductUatReports({ reportDir, startedAt, steps, summary }) {
  const finishedAt = new Date();
  const report = {
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    finishedAt: finishedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    ...summary,
    steps,
  };
  await writeFile(
    path.join(reportDir, "product-uat-summary.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(reportDir, "qa-report.md"), renderMarkdown(report), "utf8");
}

/**
 * Renders the product UAT Markdown report.
 *
 * @param {Object} report - Report data.
 * @returns {string} Markdown report.
 */
function renderMarkdown(report) {
  return [
    "# Product UAT Report",
    "",
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Passed: ${report.passed}`,
    report.error ? `Error: ${report.error}` : undefined,
    report.runIds ? `Run ids: ${report.runIds.join(", ")}` : undefined,
    "",
    "## Steps",
    "",
    "| Scenario | Step | Result | Command |",
    "| --- | --- | --- | --- |",
    ...report.steps.map(
      (step) =>
        `| ${escapeCell(step.scenario)} | ${escapeCell(step.label)} | ${step.passed ? "PASS" : "FAIL"} | ${escapeCell(step.command)} |`,
    ),
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Escapes text for a Markdown table cell.
 *
 * @param {unknown} value - Cell value.
 * @returns {string} Escaped cell value.
 */
function escapeCell(value) {
  return stringifyCellValue(value).replaceAll("|", "/").replaceAll("\n", "<br>");
}

/**
 * Converts unknown report values into explicit human-readable table text.
 *
 * @param {unknown} value - Cell value.
 * @returns {string} Stringified cell value.
 */
function stringifyCellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "unserializable";
  }
}
