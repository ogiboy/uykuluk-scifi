import type { Route } from "next";

import type { StudioActionServiceStatus } from "@/lib/actionServiceStatus";
import type { StudioAnalyticsOverview } from "@/lib/analyticsOverview";
import type { StudioAssetInventory } from "@/lib/assetInventory";
import type { StudioDoctorOverview } from "@/lib/doctorOverview";
import type { StudioIdeaHistoryOverview } from "@/lib/ideaHistoryOverview";
import type { StudioModelEvalOverview } from "@/lib/modelEvalOverview";
import type { StudioPromptInventory } from "@/lib/promptInventory";
import type { StudioRunSummary } from "@/lib/runSummaries";

export type HomeSurfaceLinksProps = Readonly<{
  actionStatus: StudioActionServiceStatus;
  analyticsOverview: StudioAnalyticsOverview;
  assetInventory: StudioAssetInventory;
  doctorOverview: StudioDoctorOverview;
  ideaHistoryOverview: StudioIdeaHistoryOverview;
  modelEvalOverview: StudioModelEvalOverview;
  promptInventory: StudioPromptInventory;
  runs: readonly StudioRunSummary[];
}>;

export type HomeSurface = Readonly<{
  detail: string;
  href: Route;
  label: string;
  metric: string;
  status: string;
  tone: SurfaceTone;
}>;

export type SurfaceTone = "blocked" | "neutral" | "passing" | "warning";

/**
 * Builds the compact Studio home route cards from current read-only service summaries.
 *
 * @param props - Current local Studio service summaries.
 * @returns Operator route cards for the home surface.
 */
export function buildHomeSurfaces(props: HomeSurfaceLinksProps): HomeSurface[] {
  const overrideCount = props.promptInventory.prompts.filter(
    (prompt) => prompt.mode === "override",
  ).length;
  const latestRun = props.runs[0] ?? null;
  return [
    {
      detail: latestRun
        ? `Latest run is ${latestRun.state}. Use the run page for evidence, artifacts, and review tabs.`
        : "No persisted runs yet. Start from the control desk, then review generated artifacts here.",
      href: "/runs",
      label: "Runs",
      metric: `${props.runs.length} persisted`,
      status: latestRun?.state ?? "empty",
      tone: latestRun?.blockedActionCount ? "blocked" : "neutral",
    },
    {
      detail: `${props.ideaHistoryOverview.generatedOnlyCount} generated-only and ${props.ideaHistoryOverview.approvedCount} approved titles are hard-blocked from exact reuse.`,
      href: "/ideas",
      label: "Ideas",
      metric: `${props.ideaHistoryOverview.totalCount} tracked titles`,
      status: props.ideaHistoryOverview.totalCount ? "tracking" : "empty",
      tone: props.ideaHistoryOverview.duplicateTitleCount > 0 ? "warning" : "neutral",
    },
    {
      detail: `${props.doctorOverview.blockCount} blocks and ${props.doctorOverview.warnCount} warnings from the latest doctor artifact.`,
      href: "/doctor",
      label: "Doctor",
      metric: `${props.doctorOverview.passCount}/${props.doctorOverview.checkCount} checks pass`,
      status: props.doctorOverview.status,
      tone: doctorTone(props.doctorOverview.status),
    },
    {
      detail: modelEvalDetail(props.modelEvalOverview),
      href: "/eval",
      label: "Model eval",
      metric: modelEvalMetric(props.modelEvalOverview),
      status: props.modelEvalOverview.status,
      tone: proofTone(props.modelEvalOverview.status),
    },
    {
      detail: `${props.analyticsOverview.mappedRunCount} mapped runs; report artifact is ${props.analyticsOverview.reportStatus}.`,
      href: "/analytics",
      label: "Analytics",
      metric: `${props.analyticsOverview.recordCount} records`,
      status: props.analyticsOverview.status,
      tone: proofTone(props.analyticsOverview.status),
    },
    {
      detail: `${props.assetInventory.warnings.length} warnings across configured brand, overlay, intro, outro, and production assets.`,
      href: "/assets",
      label: "Assets",
      metric: `${props.assetInventory.totalFiles} files`,
      status: props.assetInventory.passed ? "ready" : "needs action",
      tone: props.assetInventory.passed ? "passing" : "warning",
    },
    {
      detail: `${overrideCount} local overrides are visible here; prompt runtime still belongs to CLI/core.`,
      href: "/prompts",
      label: "Prompts",
      metric: `${props.promptInventory.prompts.length} templates`,
      status: props.promptInventory.passed ? "ready" : "needs action",
      tone: props.promptInventory.passed ? "passing" : "warning",
    },
    {
      detail: `${props.actionStatus.riskyExternalCount} external upload/publish-style contracts remain disabled by default.`,
      href: "/actions",
      label: "Actions",
      metric: `${props.actionStatus.webReadyCount}/${props.actionStatus.readyForCliCount} web-ready`,
      status: props.actionStatus.findings.length > 0 ? "findings" : "guarded",
      tone: props.actionStatus.findings.length > 0 ? "blocked" : "neutral",
    },
  ];
}

function doctorTone(status: StudioDoctorOverview["status"]): SurfaceTone {
  if (status === "blocked" || status === "invalid") {
    return "blocked";
  }
  if (status === "warning" || status === "missing") {
    return "warning";
  }
  return "passing";
}

function proofTone(status: string): SurfaceTone {
  if (status === "blocked" || status === "invalid") {
    return "blocked";
  }
  if (status === "missing" || status === "recommended" || status === "ready") {
    return "warning";
  }
  return status === "passing" ? "passing" : "neutral";
}

function modelEvalMetric(overview: StudioModelEvalOverview): string {
  if (overview.candidateReport) {
    return `${overview.candidateReport.passingCandidateCount}/${overview.candidateReport.candidateCount} candidates pass`;
  }
  if (overview.singleReport) {
    return `${overview.singleReport.passCount}/${overview.singleReport.checkCount} checks pass`;
  }
  return "no persisted eval";
}

function modelEvalDetail(overview: StudioModelEvalOverview): string {
  if (overview.candidateReport?.recommendedCandidate) {
    return `Recommended candidate: ${overview.candidateReport.recommendedCandidate.configuredModel}.`;
  }
  if (overview.singleReport) {
    return `Latest single-model eval used ${overview.singleReport.configuredModel}.`;
  }
  return "Run local model evaluation before trusting provider-backed script generation.";
}
