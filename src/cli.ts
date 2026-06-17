#!/usr/bin/env node
import { Command } from "commander";
import { initProject } from "./config/config";
import { SafeExitError } from "./core/errors";
import { listRuns, loadRun } from "./core/runStore";
import { approveIdea } from "./stages/approveIdea";
import { approveScript } from "./stages/approveScript";
import {
  publishSchedulePlaceholder,
  renderPlaceholder,
  uploadPrivatePlaceholder,
  voicePlaceholder,
} from "./stages/disabled";
import { generateEvidenceBundle } from "./stages/evidence";
import { estimateCost } from "./stages/estimate";
import { runIdeas } from "./stages/ideas";
import { generateProductionPackage } from "./stages/productionPackage";
import { runReadiness } from "./stages/readiness";
import { reviewScript } from "./stages/reviewScript";
import { generateScript } from "./stages/script";

const program = new Command();

program
  .name("producer")
  .description("Approval-gated UykulukSciFi producer workflow.")
  .version("0.1.0");

program
  .command("init")
  .description("Create local config and required directories.")
  .action(
    wrap(async () => {
      const created = await initProject();
      console.log(`Initialized project. Checked/created: ${created.join(", ")}`);
    }),
  );

program
  .command("ideas")
  .description("Generate Turkish UykulukSciFi video ideas.")
  .action(
    wrap(async () => {
      const result = await runIdeas();
      console.log(`Run created: ${result.runId}`);
      console.log(`Ideas generated: ${result.ideas.map((idea) => idea.id).join(", ")}`);
    }),
  );

const approve = program.command("approve").description("Record explicit approvals.");

approve
  .command("idea")
  .requiredOption("--run <run_id>")
  .requiredOption("--idea <idea_id>")
  .description("Approve one generated idea.")
  .action(
    wrap(async (options: { run: string; idea: string }) => {
      const approval = await approveIdea(options.run, options.idea);
      console.log(`Idea approval recorded: ${approval.approvalId}`);
    }),
  );

approve
  .command("script")
  .requiredOption("--run <run_id>")
  .description("Approve reviewed script.")
  .action(
    wrap(async (options: { run: string }) => {
      const approval = await approveScript(options.run);
      console.log(`Script approval recorded: ${approval.approvalId}`);
    }),
  );

program
  .command("script")
  .requiredOption("--run <run_id>")
  .description("Generate script for an approved idea.")
  .action(
    wrap(async (options: { run: string }) => {
      const meta = await generateScript(options.run);
      console.log(`Script generated. Words: ${meta.wordCount}`);
    }),
  );

const review = program.command("review").description("Run local reviews.");
review
  .command("script")
  .requiredOption("--run <run_id>")
  .description("Review generated script.")
  .action(
    wrap(async (options: { run: string }) => {
      const result = await reviewScript(options.run);
      console.log(`Script reviewed. Warnings: ${result.warnings.length}`);
    }),
  );

program
  .command("package")
  .requiredOption("--run <run_id>")
  .description("Generate voiceover, subtitles, scenes, and YouTube metadata drafts.")
  .action(
    wrap(async (options: { run: string }) => {
      await generateProductionPackage(options.run);
      console.log("Production package generated.");
    }),
  );

program
  .command("estimate")
  .requiredOption("--run <run_id>")
  .description("Estimate next-step costs.")
  .action(
    wrap(async (options: { run: string }) => {
      await estimateCost(options.run);
      console.log("Cost estimate generated.");
    }),
  );

program
  .command("evidence")
  .requiredOption("--run <run_id>")
  .description("Generate evidence bundle.")
  .action(
    wrap(async (options: { run: string }) => {
      await generateEvidenceBundle(options.run);
      console.log("Evidence bundle generated.");
    }),
  );

program
  .command("readiness")
  .requiredOption("--run <run_id>")
  .description("Run operator readiness diagnostics.")
  .action(
    wrap(async (options: { run: string }) => {
      const result = await runReadiness(options.run);
      console.log(`Readiness ${result.passed ? "passed" : "blocked"}.`);
      for (const check of result.checks) {
        console.log(`[${check.status}] ${check.name}: ${check.message}`);
      }
      if (!result.passed) {
        throw new SafeExitError("Readiness blocked.", 1);
      }
    }),
  );

program
  .command("status")
  .requiredOption("--run <run_id>")
  .description("Show run state and artifacts.")
  .action(
    wrap(async (options: { run: string }) => {
      const run = await loadRun(options.run);
      console.log(JSON.stringify(run, null, 2));
    }),
  );

program
  .command("list-runs")
  .description("List saved runs.")
  .action(
    wrap(async () => {
      const runs = await listRuns();
      for (const run of runs) {
        console.log(`${run.runId}\t${run.state}\t${run.updatedAt}`);
      }
    }),
  );

program
  .command("voice")
  .requiredOption("--run <run_id>")
  .description("Disabled MVP TTS placeholder.")
  .action(
    wrap(async (options: { run: string }) => {
      await voicePlaceholder(options.run);
    }),
  );

program
  .command("render")
  .requiredOption("--run <run_id>")
  .description("Disabled MVP render placeholder.")
  .action(
    wrap(async (options: { run: string }) => {
      await renderPlaceholder(options.run);
    }),
  );

const upload = program.command("upload").description("Disabled MVP upload commands.");
upload
  .command("private")
  .requiredOption("--run <run_id>")
  .description("Disabled private upload placeholder.")
  .action(
    wrap(async (options: { run: string }) => {
      await uploadPrivatePlaceholder(options.run);
    }),
  );

const publish = program.command("publish").description("Disabled MVP publish commands.");
publish
  .command("schedule")
  .requiredOption("--run <run_id>")
  .description("Disabled scheduled publish placeholder.")
  .action(
    wrap(async (options: { run: string }) => {
      await publishSchedulePlaceholder(options.run);
    }),
  );

function wrap<T extends unknown[]>(handler: (...args: T) => Promise<void>): (...args: T) => void {
  return (...args: T) => {
    handler(...args).catch((error: unknown) => {
      const code = error instanceof SafeExitError ? error.code : 1;
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = code;
    });
  };
}

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
