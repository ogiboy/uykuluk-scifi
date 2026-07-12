import { existsSync } from "node:fs";
import path from "node:path";

/** Loads optional local CLI env files without overriding variables already present in the shell. */
export function loadLocalEnvironmentFiles(root = process.cwd()): void {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(root, fileName);
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}
