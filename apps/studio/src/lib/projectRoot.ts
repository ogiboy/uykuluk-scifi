import { readFile } from "node:fs/promises";
import path from "node:path";

export async function projectRoot(): Promise<string> {
  if (process.env.UYKULUK_SCIFI_ROOT) {
    return process.env.UYKULUK_SCIFI_ROOT;
  }

  let current = /* turbopackIgnore: true */ process.cwd();
  for (;;) {
    if (await isProducerProjectRoot(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

async function isProducerProjectRoot(candidate: string): Promise<boolean> {
  try {
    const pkg = JSON.parse(
      await readFile(path.join(/* turbopackIgnore: true */ candidate, "package.json"), "utf8"),
    ) as {
      name?: string;
    };
    return pkg.name === "uykuluk-scifi";
  } catch {
    return false;
  }
}
