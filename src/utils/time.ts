import { randomBytes } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  const stamp = new Date()
    .toISOString()
    .replaceAll(/[-:.TZ]/g, "")
    .slice(0, 14);
  const random = randomBytes(3).toString("hex");
  return `${prefix}_${stamp}_${random}`;
}
