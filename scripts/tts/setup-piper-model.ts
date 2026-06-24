#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const defaultPiperModel = {
  repoId: "speaches-ai/piper-tr_TR-fahrettin-medium",
  revision: "aab8f92429ede58091e17de506484a2c84384792",
  outputDir: "models/piper/tr_TR/fahrettin-medium",
  files: ["model.onnx", "config.json"],
} as const;

const piperConfigAlias = "model.onnx.json";

export type PiperSetupOptions = {
  binary: string;
  files: readonly string[];
  outputDir: string;
  repoId: string;
  revision: string;
};

export type PiperSetupResult = {
  configSnippet: ReturnType<typeof piperConfigSnippet>;
  files: Array<{ path: string; sha256: string }>;
  manifestPath: string;
};

type FetchLike = (
  url: string,
) => Promise<Pick<Response, "arrayBuffer" | "ok" | "status" | "statusText">>;

export function defaultPiperSetupOptions(): PiperSetupOptions {
  return {
    binary: "piper",
    files: defaultPiperModel.files,
    outputDir: defaultPiperModel.outputDir,
    repoId: defaultPiperModel.repoId,
    revision: defaultPiperModel.revision,
  };
}

export function normalizeModelDir(value: string): string {
  if (path.isAbsolute(value)) {
    throw new Error("Piper model output directory must be a relative path.");
  }
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Piper model output directory cannot escape the project root.");
  }
  if (!normalized.startsWith("models/")) {
    throw new Error("Piper model output directory must stay under ignored models/.");
  }
  return normalized;
}

export function piperModelFileUrl(repoId: string, revision: string, fileName: string): string {
  return `https://huggingface.co/${repoId}/resolve/${revision}/${encodeURIComponent(fileName)}`;
}

export function piperConfigSnippet(
  modelDir: string = defaultPiperModel.outputDir,
  binary = "piper",
) {
  const normalized = normalizeModelDir(modelDir);
  return {
    providers: {
      tts: {
        enabled: true,
        mode: "local-piper",
        piperBinary: binary,
        piperModelPath: path.posix.join(normalized, "model.onnx"),
        piperConfigPath: path.posix.join(normalized, piperConfigAlias),
      },
    },
  } as const;
}

export async function setupPiperModel(
  options: Partial<PiperSetupOptions> = {},
  fetchImpl: FetchLike = fetch,
): Promise<PiperSetupResult> {
  const resolved = { ...defaultPiperSetupOptions(), ...options };
  const modelDir = normalizeModelDir(resolved.outputDir);
  await mkdir(modelDir, { recursive: true });

  const files: PiperSetupResult["files"] = [];
  for (const fileName of resolved.files) {
    if (fileName.includes("/") || fileName.includes("\\") || fileName.startsWith(".")) {
      throw new Error(`Unsupported Piper model file name: ${fileName}`);
    }
    const target = path.join(modelDir, fileName);
    const url = piperModelFileUrl(resolved.repoId, resolved.revision, fileName);
    const sha256 = await downloadFile(url, target, fetchImpl);
    files.push({ path: path.posix.join(modelDir, fileName), sha256 });
  }
  const configPath = path.join(modelDir, "config.json");
  const configAliasPath = path.join(modelDir, piperConfigAlias);
  await copyFile(configPath, configAliasPath);
  files.push({
    path: path.posix.join(modelDir, piperConfigAlias),
    sha256: createHash("sha256")
      .update(await readFile(configAliasPath))
      .digest("hex"),
  });

  const manifestPath = path.posix.join(modelDir, "install-manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        repoId: resolved.repoId,
        revision: resolved.revision,
        installedAt: new Date().toISOString(),
        files,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return {
    configSnippet: piperConfigSnippet(modelDir, resolved.binary),
    files,
    manifestPath,
  };
}

function parseArgs(argv: string[]): PiperSetupOptions {
  const options = defaultPiperSetupOptions();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!next || next.startsWith("-")) {
      throw new Error(`${arg} requires a value.`);
    }
    if (arg === "--repo") {
      options.repoId = next;
    } else if (arg === "--revision") {
      options.revision = next;
    } else if (arg === "--output-dir") {
      options.outputDir = next;
    } else if (arg === "--binary") {
      options.binary = next;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    index += 1;
  }
  return options;
}

async function downloadFile(url: string, target: string, fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const temp = `${target}.tmp-${process.pid}`;
  await rm(temp, { force: true });
  await writeFile(temp, buffer);
  await rename(temp, target);
  return createHash("sha256").update(buffer).digest("hex");
}

function printHelp(): void {
  console.log(`Usage: pnpm tts:piper:setup [options]

Downloads the default CPU-friendly Turkish Piper voice into ignored models/.

Options:
  --repo <id>          Hugging Face repo id. Default: ${defaultPiperModel.repoId}
  --revision <sha>     Hugging Face revision. Default: ${defaultPiperModel.revision}
  --output-dir <path>  Relative models/ directory. Default: ${defaultPiperModel.outputDir}
  --binary <path>      Piper binary path for the printed config snippet. Default: piper
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = await setupPiperModel(options);
  console.log(`Downloaded Piper model files to ${normalizeModelDir(options.outputDir)}.`);
  for (const file of result.files) {
    console.log(`- ${file.path} sha256=${file.sha256}`);
  }
  console.log(`Manifest: ${result.manifestPath}`);
  console.log("\nAdd this ignored producer.config.json override to enable local Piper TTS:");
  console.log(JSON.stringify(result.configSnippet, null, 2));

  if (!isBinaryAvailable(options.binary)) {
    console.log("\nIf `piper` is missing, install it locally with: uv tool install piper-tts");
  }
}

function isBinaryAvailable(binary: string): boolean {
  const result = spawnSync(binary, ["--help"], { encoding: "utf8", stdio: "ignore" });
  return result.status === 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
