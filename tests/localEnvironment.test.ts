import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { loadLocalEnvironmentFiles } from "../src/config/localEnvironment";
import { useTempProject } from "./helpers";

const localKey = "UYKULUK_ENV_LOCAL_TEST";
const shellKey = "UYKULUK_ENV_SHELL_TEST";

describe("local environment loading", () => {
  useTempProject();

  afterEach(() => {
    delete process.env[localKey];
    delete process.env[shellKey];
  });

  it("loads .env.local before .env while preserving shell values", async () => {
    await writeFile(".env.local", `${localKey}=from-local\n${shellKey}=from-local\n`, "utf8");
    await writeFile(".env", `${localKey}=from-env\n${shellKey}=from-env\n`, "utf8");
    process.env[shellKey] = "from-shell";

    loadLocalEnvironmentFiles();

    expect(process.env[localKey]).toBe("from-local");
    expect(process.env[shellKey]).toBe("from-shell");
  });
});
