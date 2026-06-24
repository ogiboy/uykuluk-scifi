#!/usr/bin/env tsx
import { buildCurrentReleasePlan, exitWithInvalidCommits } from "./releaseState.js";

const plan = buildCurrentReleasePlan();
exitWithInvalidCommits(plan);

console.log(`Conventional release commit check passed for ${plan.releaseRange}.`);
