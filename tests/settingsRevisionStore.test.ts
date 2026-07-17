import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  configDigest,
  readCurrentSettings,
  readSettingsRevision,
  saveSettingsRevision,
} from "../src/settings/settingsRevisionStore";
import { useTempProject } from "./helpers";

describe("settings revision store", () => {
  useTempProject();

  it("writes an immutable revision before atomically updating the canonical config", async () => {
    const root = process.cwd();
    const current = await readCurrentSettings(root);
    const next = { ...current.config, channel: { ...current.config.channel, name: "Yeni Kanal" } };

    const saved = await saveSettingsRevision({
      projectRoot: root,
      expectedCurrentDigest: current.digest,
      config: next,
      editor: "operator@example.test",
      note: "Kanal adı güncellendi",
    });

    expect(saved.changedPaths).toEqual(["channel.name"]);
    expect(saved.config.settingsRevision).toBe(current.config.settingsRevision + 1);
    expect(saved.previousDigest).toBe(current.digest);
    expect(saved.configDigest).toBe(configDigest(saved.config));
    expect(
      JSON.parse(await readFile(path.join(root, "producer.config.json"), "utf8")),
    ).toMatchObject({ channel: { name: "Yeni Kanal" } });
    expect(
      JSON.parse(
        await readFile(
          path.join(root, "producer.config.revisions", `${saved.revisionId}.json`),
          "utf8",
        ),
      ),
    ).toMatchObject({ revisionId: saved.revisionId, editor: "operator@example.test" });
  });

  it("fails closed when the supplied digest is stale", async () => {
    const root = process.cwd();
    const configBefore = await readFile(path.join(root, "producer.config.json"), "utf8");
    const revisionsBefore = await revisionFiles(root);
    await expect(
      saveSettingsRevision({
        projectRoot: root,
        expectedCurrentDigest: "0".repeat(64),
        config: (await readCurrentSettings(root)).config,
        editor: "operator",
        note: "stale",
      }),
    ).rejects.toThrow("Settings changed before this save could be applied");
    await expect(readFile(path.join(root, "producer.config.json"), "utf8")).resolves.toBe(
      configBefore,
    );
    await expect(revisionFiles(root)).resolves.toEqual(revisionsBefore);
  });

  it("rejects a revision whose stored config digest no longer matches its config", async () => {
    const root = process.cwd();
    const current = await readCurrentSettings(root);
    const saved = await saveSettingsRevision({
      projectRoot: root,
      expectedCurrentDigest: current.digest,
      config: { ...current.config, channel: { ...current.config.channel, name: "Yeni Kanal" } },
      editor: "operator",
      note: "digest integrity",
    });
    const revisionPath = path.join(root, "producer.config.revisions", `${saved.revisionId}.json`);
    const tampered = JSON.parse(await readFile(revisionPath, "utf8")) as Record<string, unknown>;
    tampered.configDigest = "0".repeat(64);
    await writeFile(revisionPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");

    await expect(readSettingsRevision(root, saved.revisionId)).rejects.toThrow(
      "Settings revision config digest does not match",
    );
  });

  it("serializes concurrent saves and rechecks the digest after the lock", async () => {
    const root = process.cwd();
    const current = await readCurrentSettings(root);
    const save = (name: string) =>
      saveSettingsRevision({
        projectRoot: root,
        expectedCurrentDigest: current.digest,
        config: { ...current.config, channel: { ...current.config.channel, name } },
        editor: "operator",
        note: `rename ${name}`,
      });

    const results = await Promise.allSettled([save("Kanal A"), save("Kanal B")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(readCurrentSettings(root)).resolves.toMatchObject({
      config: { settingsRevision: current.config.settingsRevision + 1 },
    });
  });
});

async function revisionFiles(root: string): Promise<string[]> {
  try {
    return await readdir(path.join(root, "producer.config.revisions"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
