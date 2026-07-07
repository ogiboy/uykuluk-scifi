import type { StudioRunSummary } from "@/lib/runSummaries";
import {
  formatRunChannelHandoff,
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
} from "@/lib/runSummaryCopy";
import type { ColumnDef } from "@tanstack/react-table";
import { operatorActionForRun, operatorActionSearchText } from "./runSummaryOperatorAction";
import { RunSummaryRowActions } from "./RunSummaryRowActions";
import {
  RunBlockedActionCell,
  RunChannelHandoffCell,
  RunDecisionCell,
  RunEvidenceCell,
  RunFinalBundleCell,
  RunIdCell,
  RunNextActionCell,
  RunOperatorActionCell,
  RunReadinessCell,
  RunStateCell,
  RunUpdatedCell,
} from "./RunSummaryTableCells";

type RunTableColumnMeta = Readonly<{ label: string }>;

export function runSummaryColumns(): ColumnDef<StudioRunSummary>[] {
  return [
    textColumn("runId", "Run", ({ row }) => <RunIdCell run={row.original} />, false),
    textColumn("state", "State", ({ row }) => <RunStateCell run={row.original} />),
    textColumn("readinessStatus", "Readiness", ({ row }) => (
      <RunReadinessCell run={row.original} />
    )),
    textColumn("evidenceStatus", "Evidence", ({ row }) => <RunEvidenceCell run={row.original} />),
    {
      accessorFn: (run) => operatorActionSearchText(operatorActionForRun(run)),
      cell: ({ row }) => <RunOperatorActionCell run={row.original} />,
      header: "Operator action",
      id: "operatorAction",
      meta: { label: "Operator action" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) =>
        `${formatRunRenderDecision(run)} ${formatRunChannelHandoffDecision(run)}`,
      cell: ({ row }) => <RunDecisionCell run={row.original} />,
      header: "Decision",
      id: "renderDecision",
      meta: { label: "Render decision" } satisfies RunTableColumnMeta,
    },
    textColumn("blockedActionCount", "Blocks", ({ row }) => (
      <RunBlockedActionCell run={row.original} />
    )),
    textColumn("updatedAt", "Updated", ({ row }) => <RunUpdatedCell run={row.original} />),
    {
      accessorFn: (run) => formatRunFinalReviewBundle(run),
      cell: ({ row }) => <RunFinalBundleCell run={row.original} />,
      header: "Final bundle",
      id: "finalBundle",
      meta: { label: "Final bundle" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => formatRunChannelHandoff(run),
      cell: ({ row }) => <RunChannelHandoffCell run={row.original} />,
      header: "Channel handoff",
      id: "channelHandoff",
      meta: { label: "Channel handoff" } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => run.nextRecommendedCommand ?? "Generate evidence",
      cell: ({ row }) => <RunNextActionCell run={row.original} />,
      header: "Next action",
      id: "nextAction",
      meta: { label: "Next action" } satisfies RunTableColumnMeta,
    },
    {
      cell: ({ row }) => <RunSummaryRowActions run={row.original} />,
      enableHiding: false,
      enableSorting: false,
      header: "Actions",
      id: "actions",
      meta: { label: "Actions" } satisfies RunTableColumnMeta,
    },
  ];
}

export function runColumnClassName(columnId: string): string {
  switch (columnId) {
    case "actions":
      return "w-56";
    case "blockedActionCount":
      return "w-20 text-center max-[1400px]:hidden";
    case "channelHandoff":
    case "finalBundle":
    case "nextAction":
      return "min-w-64 max-[1400px]:hidden";
    case "operatorAction":
    case "renderDecision":
      return "min-w-56 max-[1400px]:hidden";
    case "readinessStatus":
      return "min-w-56 max-[1100px]:hidden";
    case "runId":
      return "min-w-44 px-3 py-3 text-left align-top text-sm";
    case "state":
      return "min-w-44";
    case "evidenceStatus":
      return "min-w-44 max-[1400px]:hidden";
    case "updatedAt":
      return "w-28 whitespace-nowrap max-[1400px]:hidden";
    default:
      return "";
  }
}

export function runColumnLabel(meta: unknown): string {
  if (meta && typeof meta === "object" && "label" in meta && typeof meta.label === "string") {
    return meta.label;
  }
  return "Column";
}

function textColumn(
  accessorKey: keyof StudioRunSummary,
  label: string,
  cell: ColumnDef<StudioRunSummary>["cell"],
  enableHiding = true,
): ColumnDef<StudioRunSummary> {
  return {
    accessorKey,
    cell,
    enableHiding,
    header: label,
    meta: { label } satisfies RunTableColumnMeta,
  };
}
