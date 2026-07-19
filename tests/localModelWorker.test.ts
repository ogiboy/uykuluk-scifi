import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeApprovedLocalModelOperation,
  localModelStatePaths,
  prepareLocalModelOperation,
  readOverview,
} from "../src/localModels/localModelReadiness.js";
import { runLocalModelWorker } from "../src/localModels/localModelWorker.js";
import { executeMfluxWorker } from "../src/localModels/mfluxProcess.js";

vi.mock("../src/localModels/mfluxProcess.js", () => ({ executeMfluxWorker: vi.fn() }));

const projects: string[] = [];

afterEach(async () => {
  vi.mocked(executeMfluxWorker).mockReset();
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local model worker", () => {
  it("rehydrates an approved setup and writes durable run evidence before readiness", async () => {
    const root = await projectRoot();
    const preparation = await prepareLocalModelOperation(root, {
      packageId: "mflux-flux2-klein-4b-q4",
      operation: "setup",
    });
    const operation = await executeApprovedLocalModelOperation(root, {
      runId: preparation.runId,
      bindingDigest: preparation.bindingDigest,
      approvedBy: "Studio operator",
      confirmExecution: true,
    });
    vi.mocked(executeMfluxWorker).mockImplementation(async (_projectRoot, request) => {
      await mkdir(request.runtimePath, { recursive: true });
      await writeFile(
        path.join(request.runtimePath, "install-manifest.json"),
        '{"schemaVersion":1}\n',
        "utf8",
      );
      return { status: "ok", operation: "setup" };
    });

    await runLocalModelWorker(root);

    await expect(readOverview(root)).resolves.toMatchObject({
      readiness: "ready",
      latestOperation: { operationId: operation.operationId, status: "succeeded" },
    });
    const evidence = JSON.parse(
      await readFile(
        path.join(root, "runs", preparation.runId, "diagnostics", "local-models", "worker.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      operationId: operation.operationId,
      kind: "setup",
      status: "succeeded",
      diagnostic: "mflux-setup-completed",
      installManifestDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      model: {
        id: "mflux-flux2-klein-4b-q4",
        revision: "860e87183ceb29e39627c0612ebd66d8ea66e68c",
        runtimeVersion: "0.18.0",
      },
    });
  });
});

async function projectRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "uykulukscifi-local-worker-"));
  projects.push(root);
  const paths = localModelStatePaths(root);
  await mkdir(paths.runtimePath, { recursive: true });
  return root;
}
