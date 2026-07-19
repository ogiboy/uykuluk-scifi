import type { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeMfluxWorker } from "../src/localModels/mfluxProcess.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("bounded MFLUX process", () => {
  it("extracts the worker JSON result from surrounding uv diagnostics", async () => {
    const child = fakeChild();
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    queueMicrotask(() => {
      (child.stderr as PassThrough).write("Resolved pinned environment\n");
      (child.stdout as PassThrough).write('{"status":"ok","operation":"verify"}\n');
      child.emit("close", 0, null);
    });

    await expect(
      executeMfluxWorker(
        "/project",
        { operation: "verify", runtimePath: "/project/.local-models/mflux" },
        2_000,
        spawnProcess,
      ),
    ).resolves.toEqual({ status: "ok", operation: "verify" });
    expect(spawnProcess).toHaveBeenCalledWith(
      "uv",
      expect.arrayContaining(["--offline", "--locked", "--no-sync", "--operation", "verify"]),
      expect.objectContaining({ cwd: "/project" }),
    );
  });

  it("allows only the approved setup operation to create or synchronize the locked environment", async () => {
    const child = fakeChild();
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    queueMicrotask(() => {
      (child.stdout as PassThrough).write('{"status":"ok","operation":"setup"}\n');
      child.emit("close", 0, null);
    });

    await expect(
      executeMfluxWorker(
        "/project",
        { operation: "setup", runtimePath: "/project/.local-models/mflux" },
        2_000,
        spawnProcess,
      ),
    ).resolves.toEqual({ status: "ok", operation: "setup" });
    const args = vi.mocked(spawnProcess).mock.calls[0]![1];
    expect(args).toContain("--locked");
    expect(args).not.toContain("--offline");
    expect(args).not.toContain("--no-sync");
  });

  it("does not forward hosted-provider credentials to the Python child", async () => {
    const child = fakeChild();
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    const priorElevenLabs = process.env.ELEVENLABS_API_KEY;
    const priorBfl = process.env.BFL_API_KEY;
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-secret";
    process.env.BFL_API_KEY = "test-bfl-secret";
    queueMicrotask(() => {
      (child.stdout as PassThrough).write('{"status":"ok","operation":"verify"}\n');
      child.emit("close", 0, null);
    });

    try {
      await executeMfluxWorker(
        "/project",
        { operation: "verify", runtimePath: "/project/.local-models/mflux" },
        2_000,
        spawnProcess,
      );
      const environment = vi.mocked(spawnProcess).mock.calls[0]![2]?.env;
      expect(environment).not.toHaveProperty("ELEVENLABS_API_KEY");
      expect(environment).not.toHaveProperty("BFL_API_KEY");
    } finally {
      restoreEnvironment("ELEVENLABS_API_KEY", priorElevenLabs);
      restoreEnvironment("BFL_API_KEY", priorBfl);
    }
  });

  it("surfaces only the worker's bounded failure code", async () => {
    const child = fakeChild();
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    queueMicrotask(() => {
      (child.stdout as PassThrough).write('{"status":"error","code":"install-manifest-missing"}\n');
      child.emit("close", 1, null);
    });

    await expect(
      executeMfluxWorker(
        "/project",
        { operation: "verify", runtimePath: "/project/.local-models/mflux" },
        2_000,
        spawnProcess,
      ),
    ).rejects.toThrow(/install-manifest-missing/);
  });

  it("terminates a worker that exceeds the operation timeout", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));
      return true;
    });
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    const execution = executeMfluxWorker(
      "/project",
      { operation: "verify", runtimePath: "/project/.local-models/mflux" },
      1_000,
      spawnProcess,
    );
    const rejected = expect(execution).rejects.toThrow(/timed out after 1000ms/i);

    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
});

function fakeChild(): ChildProcessWithoutNullStreams {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(() => true),
    pid: 12_345,
  });
  return child;
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
