import type { RunRecord } from "../../core/state.js";
import { verifyProductionPackage } from "../production/productionPackageIntegrity.js";
import type { ReadinessCheck } from "../readiness.js";

export async function productionPackageIntegrityCheck(run: RunRecord): Promise<ReadinessCheck> {
  try {
    const { digest } = await verifyProductionPackage(run);
    return {
      name: "production package integrity",
      status: "pass",
      message: `Complete production package matches manifest ${digest}.`,
    };
  } catch (error) {
    return {
      name: "production package integrity",
      status: "block",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
