import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const EXPECTED_VERSIONS = { tsc: 7, tsc6: 6 };

/**
 * Reads a local TypeScript compiler version and fails with the compiler output when unavailable.
 *
 * @param {keyof typeof EXPECTED_VERSIONS} command
 * @returns {string}
 */
function readCompilerVersion(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.error?.message || "unknown error";
    throw new Error(`Unable to run ${command}: ${detail}`);
  }

  return result.stdout.trim();
}

/**
 * Extracts and validates the compiler major version from `Version X.Y.Z` output.
 *
 * @param {keyof typeof EXPECTED_VERSIONS} command
 * @param {string} output
 * @returns {number}
 */
function validateCompilerVersion(command, output) {
  const match = /^Version (?<major>\d+)\.\d+\.\d+(?:-.+)?$/.exec(output);
  if (!match?.groups?.major) {
    throw new Error(`Unexpected ${command} version output: ${output}`);
  }

  const actualMajor = Number(match.groups.major);
  const expectedMajor = EXPECTED_VERSIONS[command];
  if (actualMajor !== expectedMajor) {
    throw new Error(`${command} must use TypeScript ${expectedMajor}, received ${output}`);
  }

  return actualMajor;
}

for (const command of Object.keys(EXPECTED_VERSIONS)) {
  const output = readCompilerVersion(command);
  validateCompilerVersion(command, output);
  console.log(`${command}: ${output}`);
}

const apiVersion = require("typescript").version;
if (!apiVersion.startsWith("6.")) {
  throw new Error(`The TypeScript JavaScript API must remain on major 6, received ${apiVersion}`);
}

console.log(`typescript API: Version ${apiVersion}`);

console.log("TypeScript dual-toolchain check passed.");
