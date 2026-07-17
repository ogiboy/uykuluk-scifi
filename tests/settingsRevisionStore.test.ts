import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  configDigest,
  readCurrentSettings,
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
    await expect(
      saveSettingsRevision({
        projectRoot: process.cwd(),
        expectedCurrentDigest: "0".repeat(64),
        config: (await readCurrentSettings(process.cwd())).config,
        editor: "operator",
        note: "stale",
      }),
    ).rejects.toThrow("Settings changed before this save could be applied");
  });
});
