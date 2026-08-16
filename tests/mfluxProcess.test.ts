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
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
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
        {
          operation: "setup",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
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
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
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
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        2_000,
        spawnProcess,
      ),
    ).rejects.toThrow(/install-manifest-missing/);
  });

  it("rejects invalid diagnostics and mismatched operation results", async () => {
    const invalidChild = fakeChild();
    const invalidSpawn = vi.fn(() => invalidChild) as unknown as typeof spawn;
    queueMicrotask(() => {
      (invalidChild.stdout as PassThrough).write("not-json\n");
      invalidChild.emit("close", 0, null);
    });

    await expect(
      executeMfluxWorker(
        "/project",
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        2_000,
        invalidSpawn,
      ),
    ).rejects.toThrow(/invalid diagnostic response/i);

    const mismatchChild = fakeChild();
    const mismatchSpawn = vi.fn(() => mismatchChild) as unknown as typeof spawn;
    queueMicrotask(() => {
      (mismatchChild.stdout as PassThrough).write('{"status":"ok","operation":"setup"}\n');
      mismatchChild.emit("close", 0, null);
    });

    await expect(
      executeMfluxWorker(
        "/project",
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        2_000,
        mismatchSpawn,
      ),
    ).rejects.toThrow(/different operation/i);
  });

  it("reports bounded startup and empty-output process failures", async () => {
    const startupChild = fakeChild();
    const startupSpawn = vi.fn(() => startupChild) as unknown as typeof spawn;
    queueMicrotask(() => {
      const error = Object.assign(new Error("spawn failed"), { code: "ENOENT" });
      startupChild.emit("error", error);
    });

    await expect(
      executeMfluxWorker(
        "/project",
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        2_000,
        startupSpawn,
      ),
    ).rejects.toThrow(/could not start \(ENOENT\)/i);

    const exitChild = fakeChild();
    const exitSpawn = vi.fn(() => exitChild) as unknown as typeof spawn;
    queueMicrotask(() => exitChild.emit("close", 23, null));

    await expect(
      executeMfluxWorker(
        "/project",
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        2_000,
        exitSpawn,
      ),
    ).rejects.toThrow(/exit code 23/i);
  });

  it("passes only generation-specific paths, seed, and approved cache environment", async () => {
    const child = fakeChild();
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    const previousCache = process.env.UV_CACHE_DIR;
    process.env.UV_CACHE_DIR = "/safe/uv-cache";
    queueMicrotask(() => {
      (child.stdout as PassThrough).write(
        '{"status":"ok","operation":"generate","durationMs":123}\n',
      );
      child.emit("close", 0, null);
    });

    try {
      await expect(
        executeMfluxWorker(
          "/project",
          {
            operation: "generate",
            outputPath: "/project/output.png",
            promptPath: "/project/prompt.txt",
            runtimePath: "/project/.local-models/mflux",
            modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
            seed: 42,
          },
          2_000,
          spawnProcess,
        ),
      ).resolves.toMatchObject({ operation: "generate", durationMs: 123 });
      const [command, args, options] = vi.mocked(spawnProcess).mock.calls[0]!;
      expect(command).toBe("uv");
      expect(args).toEqual(
        expect.arrayContaining([
          "--offline",
          "--no-sync",
          "--output-path",
          "/project/output.png",
          "--prompt-path",
          "/project/prompt.txt",
          "--seed",
          "42",
        ]),
      );
      expect(options?.env).toMatchObject({ UV_CACHE_DIR: "/safe/uv-cache" });
    } finally {
      restoreEnvironment("UV_CACHE_DIR", previousCache);
    }
  });

  it("rejects timeout values outside the supported worker window before spawning", async () => {
    const spawnProcess = vi.fn(() => fakeChild()) as unknown as typeof spawn;

    await expect(
      executeMfluxWorker(
        "/project",
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        999,
        spawnProcess,
      ),
    ).rejects.toThrow(/outside the supported bounds/i);
    await expect(
      executeMfluxWorker(
        "/project",
        {
          operation: "verify",
          runtimePath: "/project/.local-models/mflux",
          modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
        },
        3_600_001,
        spawnProcess,
      ),
    ).rejects.toThrow(/outside the supported bounds/i);
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("terminates a worker that exceeds the operation timeout", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    child.kill = vi.fn((signal) => {
      if (signal === "SIGKILL") queueMicrotask(() => child.emit("close", null, "SIGKILL"));
      return true;
    });
    const spawnProcess = vi.fn(() => child) as unknown as typeof spawn;
    const execution = executeMfluxWorker(
      "/project",
      {
        operation: "verify",
        runtimePath: "/project/.local-models/mflux",
        modelPath: "/project/models/visual/mflux/flux2-klein-4b-q4",
      },
      1_000,
      spawnProcess,
    );
    const rejected = expect(execution).rejects.toThrow(/timed out after 1000ms/i);

    await vi.advanceTimersByTimeAsync(3_000);
    await rejected;
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
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
