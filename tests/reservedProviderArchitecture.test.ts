import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("reserved provider architecture", () => {
  it("keeps provider and stage modules away from low-level cost lifecycle mutations", async () => {
    for (const directory of ["src/providers", "src/stages"]) {
      for (const relativePath of await typescriptFiles(directory)) {
        const source = await readFile(relativePath, "utf8");
        expect(source, relativePath).not.toMatch(
          /from ["'][^"']*cost(?:ReservationService|ReservationExecutionState|SettlementService)["']/,
        );
      }
    }
  });

  it("keeps execution-state transitions owned by the reserved-provider orchestrator", async () => {
    const allowed = new Set([
      path.normalize("src/costs/costReservationExecutionState.ts"),
      path.normalize("src/costs/reservedProviderExecution.ts"),
    ]);
    for (const relativePath of await typescriptFiles("src")) {
      if (allowed.has(path.normalize(relativePath))) {
        continue;
      }
      const source = await readFile(relativePath, "utf8");
      expect(source, relativePath).not.toContain("costReservationExecutionState");
    }
  });
});

async function typescriptFiles(directory: string): Promise<string[]> {
  return (await readdir(directory, { recursive: true }))
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => path.join(directory, entry));
}
