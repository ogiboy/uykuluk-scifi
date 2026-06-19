import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const deprecatedPatterns = [
  {
    name: "deprecated chained string format",
    pattern:
      /z\.string\(\)\.(?:email|url|jwt|emoji|guid|uuid|uuidv4|uuidv6|uuidv7|nanoid|cuid|cuid2|ulid|base64|base64url|xid|ksuid|ipv4|ipv6|cidrv4|cidrv6|e164|datetime|date|time|duration)\s*\(/g,
  },
  { name: "deprecated object strict method", pattern: /\.strict\(\)/g },
  { name: "deprecated object passthrough method", pattern: /\.passthrough\(\)/g },
  { name: "redundant object strip method", pattern: /\.strip\(\)/g },
  { name: "deprecated object merge method", pattern: /\.merge\(/g },
  { name: "deprecated native enum", pattern: /z\.nativeEnum\(/g },
  { name: "legacy chained integer format", pattern: /z\.number\(\)\.int\(\)/g },
  { name: "deprecated safe number format", pattern: /\.safe\(\)/g },
  { name: "deprecated number step method", pattern: /\.step\(/g },
  { name: "redundant finite number method", pattern: /\.finite\(\)/g },
] as const;

describe("Zod 4 schema conventions", () => {
  it("does not use deprecated or legacy Zod 3 schema APIs", async () => {
    const findings: string[] = [];
    for (const file of await sourceFiles("src")) {
      const source = await readFile(file, "utf8");
      for (const { name, pattern } of deprecatedPatterns) {
        pattern.lastIndex = 0;
        for (const match of source.matchAll(pattern)) {
          const line = source.slice(0, match.index).split("\n").length;
          findings.push(`${file}:${line}: ${name}: ${match[0]}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(target);
      }
      return entry.isFile() && target.endsWith(".ts") ? [target] : [];
    }),
  );
  return files.flat().sort();
}
