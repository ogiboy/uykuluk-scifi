import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Loads `.env.local` and `.env` files found in the specified directory.
 *
 * @param root - Directory containing the local environment files
 */
export function loadLocalEnvironmentFiles(root = process.cwd()): void {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(root, fileName);
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}
