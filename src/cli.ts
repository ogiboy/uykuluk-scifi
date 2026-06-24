#!/usr/bin/env node
import { Command } from "commander";
import { registerAnalyticsCommands } from "./cli/analyticsCommands.js";
import { registerApprovalCommands } from "./cli/approvalCommands.js";
import { registerRevisionCommands } from "./cli/revisionCommands.js";
import { initProject } from "./config/config.js";
import { SafeExitError } from "./core/errors.js";
import { listRuns, loadRun } from "./core/runStore.js";
import { runDoctor } from "./diagnostics/doctor.js";
import { publishSchedulePlaceholder, uploadPrivatePlaceholder } from "./stages/disabled.js";
import { generateEvidenceBundle } from "./stages/evidence.js";
import { estimateCost } from "./stages/estimate.js";
import { runIdeas } from "./stages/ideas.js";
import { generateProductionPackage } from "./stages/productionPackage.js";
import { runReadiness } from "./stages/readiness.js";
import { renderDraft } from "./stages/render.js";
import { generateRenderPlan } from "./stages/renderPlan.js";
import { reviewScript } from "./stages/reviewScript.js";
import { generateScript } from "./stages/script.js";
import { formatRunStatus, readRunStatus } from "./stages/status.js";
import { generateVoiceoverAudio } from "./stages/voice.js";

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

program
  .command("doctor")
  .description("Diagnose local config, provider, assets, and publish safety.")
  .action(
    wrap(async () => {
      const report = await runDoctor();
      console.log(`Doctor ${report.passed ? "passed" : "blocked"}.`);
      for (const check of report.checks) {
        console.log(`[${check.status}] ${check.name}: ${check.message}`);
      }
      if (!report.passed) {
        throw new SafeExitError("Doctor blocked.", 1);
      }
    }),
  );

registerApprovalCommands(program, wrap);
registerAnalyticsCommands(program, wrap);

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

registerRevisionCommands(program, wrap);

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
  .command("render-plan")
  .requiredOption("--run <run_id>")
  .description("Generate a deterministic render plan and storyboard contact sheet.")
  .action(
    wrap(async (options: { run: string }) => {
      await generateRenderPlan(options.run);
      console.log("Render plan generated.");
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
  .option("--json", "Print the raw run state JSON for automation.")
  .description("Show run state and artifacts.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      console.log(
        options.json
          ? JSON.stringify(await loadRun(options.run), null, 2)
          : formatRunStatus(await readRunStatus(options.run)),
      );
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
  .description("Generate local voiceover audio after readiness and render planning.")
  .action(
    wrap(async (options: { run: string }) => {
      const meta = await generateVoiceoverAudio(options.run);
      console.log(`Voiceover generated. Duration: ${Math.round(meta.output.durationSeconds)}s`);
    }),
  );

program
  .command("render")
  .requiredOption("--run <run_id>")
  .description("Generate a local FFmpeg draft render after explicit render approval.")
  .action(
    wrap(async (options: { run: string }) => {
      const manifest = await renderDraft(options.run);
      console.log(`Draft render generated: ${manifest.output.path}`);
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
