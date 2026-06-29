#!/usr/bin/env node
import { Command } from "commander";
import { registerAnalyticsCommands } from "./cli/analyticsCommands.js";
import { registerApprovalCommands } from "./cli/approvalCommands.js";
import { registerDecisionCommands } from "./cli/decisionCommands.js";
import { registerEvaluationCommands } from "./cli/evaluationCommands.js";
import { registerGenerationCommands } from "./cli/generationCommands.js";
import { registerOperatorDeskCommand } from "./cli/operatorDeskCommand.js";
import { registerRevisionCommands } from "./cli/revisionCommands.js";
import { resolveStatusRunId } from "./cli/statusRunSelector.js";
import { initProject } from "./config/config.js";
import { SafeExitError } from "./core/errors.js";
import { listRuns, loadRun } from "./core/runStore.js";
import { formatDoctorConsole, runDoctor } from "./diagnostics/doctor.js";
import { publishSchedulePlaceholder, uploadPrivatePlaceholder } from "./stages/disabled.js";
import { runReadiness } from "./stages/readiness.js";
import { formatReadinessConsole } from "./stages/readinessConsole.js";
import { renderDraft } from "./stages/render.js";
import { formatRenderDraftConsole } from "./stages/renderConsole.js";
import { reviewDraftRender } from "./stages/reviewRender.js";
import { formatRenderPlanReviewConsole, reviewRenderPlan } from "./stages/reviewRenderPlan.js";
import { reviewScript } from "./stages/reviewScript.js";
import { formatVoiceoverReviewConsole, reviewVoiceover } from "./stages/reviewVoiceover.js";
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
  .command("doctor")
  .option("--json", "Print the raw doctor report JSON for automation.")
  .description("Diagnose local config, provider, assets, and publish safety.")
  .action(
    wrap(async (options: { json?: boolean }) => {
      const report = await runDoctor();
      console.log(options.json ? JSON.stringify(report, null, 2) : formatDoctorConsole(report));
      if (!report.passed) {
        throw new SafeExitError("Doctor blocked.", 1);
      }
    }),
  );

registerApprovalCommands(program, wrap);
registerAnalyticsCommands(program, wrap);
registerDecisionCommands(program, wrap);
registerEvaluationCommands(program, wrap);
registerGenerationCommands(program, wrap);
registerOperatorDeskCommand(program, wrap);

const review = program.command("review").description("Run local reviews.");
review
  .command("render-plan")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw render-plan review handoff JSON for automation.")
  .description("Show the local render-plan and contact-sheet review handoff.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const handoff = await reviewRenderPlan(options.run);
      console.log(
        options.json ? JSON.stringify(handoff, null, 2) : formatRenderPlanReviewConsole(handoff),
      );
    }),
  );
review
  .command("voice")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw voiceover review handoff JSON for automation.")
  .description("Show the local voiceover review handoff.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const handoff = await reviewVoiceover(options.run);
      console.log(
        options.json ? JSON.stringify(handoff, null, 2) : formatVoiceoverReviewConsole(handoff),
      );
    }),
  );
review
  .command("script")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw script review JSON for automation.")
  .description("Review generated script.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const result = await reviewScript(options.run);
      console.log(
        options.json
          ? JSON.stringify(result, null, 2)
          : `Script reviewed. Warnings: ${result.warnings.length}`,
      );
    }),
  );
review
  .command("render")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw draft render manifest JSON for automation.")
  .description("Show the local draft render review handoff.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const manifest = await reviewDraftRender(options.run);
      console.log(
        options.json ? JSON.stringify(manifest, null, 2) : formatRenderDraftConsole(manifest),
      );
    }),
  );

registerRevisionCommands(program, wrap);

program
  .command("readiness")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw readiness diagnostics JSON for automation.")
  .description("Run operator readiness diagnostics.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const result = await runReadiness(options.run);
      console.log(
        options.json
          ? JSON.stringify(result, null, 2)
          : formatReadinessConsole(options.run, result),
      );
      if (!result.passed) {
        throw new SafeExitError("Readiness blocked.", 1);
      }
    }),
  );

program
  .command("status")
  .option("--run <run_id>")
  .option("--latest", "Show the most recently created run.")
  .option("--json", "Print the raw persisted run state JSON for automation.")
  .option("--summary-json", "Print the operator status summary JSON for automation.")
  .description("Show run state and artifacts.")
  .action(
    wrap(
      async (options: {
        json?: boolean;
        latest?: boolean;
        run?: string;
        summaryJson?: boolean;
      }) => {
        if (options.json && options.summaryJson) {
          throw new SafeExitError("Use either --json or --summary-json, not both.");
        }
        const runId = await resolveStatusRunId(options);
        if (options.summaryJson) {
          console.log(JSON.stringify(await readRunStatus(runId), null, 2));
          return;
        }
        console.log(
          options.json
            ? JSON.stringify(await loadRun(runId), null, 2)
            : formatRunStatus(await readRunStatus(runId)),
        );
      },
    ),
  );

program
  .command("list-runs")
  .option("--json", "Print the raw run list JSON for automation.")
  .description("List saved runs.")
  .action(
    wrap(async (options: { json?: boolean }) => {
      const runs = await listRuns();
      if (options.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }
      for (const run of runs) {
        console.log(`${run.runId}\t${run.state}\t${run.updatedAt}`);
      }
    }),
  );

program
  .command("voice")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw voiceover metadata JSON for automation.")
  .description("Generate local voiceover audio after readiness and render planning.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const meta = await generateVoiceoverAudio(options.run);
      console.log(
        options.json
          ? JSON.stringify(meta, null, 2)
          : `Voiceover generated. Duration: ${Math.round(meta.output.durationSeconds)}s`,
      );
    }),
  );

program
  .command("render")
  .requiredOption("--run <run_id>")
  .option("--json", "Print the raw draft render manifest JSON for automation.")
  .description("Generate a local FFmpeg draft render after explicit render approval.")
  .action(
    wrap(async (options: { json?: boolean; run: string }) => {
      const manifest = await renderDraft(options.run);
      console.log(
        options.json ? JSON.stringify(manifest, null, 2) : formatRenderDraftConsole(manifest),
      );
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

try {
  await program.parseAsync(process.argv);
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
