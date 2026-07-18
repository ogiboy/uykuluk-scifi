import type { StudioLocale } from "@/i18n/locales";
import {
  formatRunChannelHandoff,
  formatRunChannelHandoffDecision,
  formatRunFinalReviewBundle,
  formatRunRenderDecision,
} from "@/lib/runs/runSummaryCopy";
import type { StudioRunSummary } from "@/lib/runSummaries";
import type { ColumnDef } from "@tanstack/react-table";
import { runQueueCopy } from "./runQueueCopy";
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

export function runSummaryColumns(locale: StudioLocale): ColumnDef<StudioRunSummary>[] {
  const copy = runQueueCopy(locale);
  return [
    textColumn(
      "runId",
      copy.tableColumns.runId,
      ({ row }) => <RunIdCell run={row.original} />,
      false,
    ),
    textColumn("state", copy.tableColumns.state, ({ row }) => <RunStateCell run={row.original} />),
    textColumn("readinessStatus", copy.tableColumns.readinessStatus, ({ row }) => (
      <RunReadinessCell run={row.original} />
    )),
    textColumn("evidenceStatus", copy.tableColumns.evidenceStatus, ({ row }) => (
      <RunEvidenceCell run={row.original} />
    )),
    {
      accessorFn: (run) => operatorActionSearchText(operatorActionForRun(run)),
      cell: ({ row }) => <RunOperatorActionCell run={row.original} />,
      header: copy.tableColumns.operatorAction,
      id: "operatorAction",
      meta: { label: copy.tableColumns.operatorAction } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) =>
        `${formatRunRenderDecision(run)} ${formatRunChannelHandoffDecision(run)}`,
      cell: ({ row }) => <RunDecisionCell run={row.original} />,
      header: copy.tableColumns.renderDecision,
      id: "renderDecision",
      meta: { label: copy.tableColumns.renderDecision } satisfies RunTableColumnMeta,
    },
    textColumn("blockedActionCount", copy.tableColumns.blockedActionCount, ({ row }) => (
      <RunBlockedActionCell run={row.original} />
    )),
    textColumn("updatedAt", copy.tableColumns.updatedAt, ({ row }) => (
      <RunUpdatedCell locale={locale} run={row.original} />
    )),
    {
      accessorFn: (run) => formatRunFinalReviewBundle(run),
      cell: ({ row }) => <RunFinalBundleCell run={row.original} />,
      header: copy.tableColumns.finalBundle,
      id: "finalBundle",
      meta: { label: copy.tableColumns.finalBundle } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => formatRunChannelHandoff(run),
      cell: ({ row }) => <RunChannelHandoffCell run={row.original} />,
      header: copy.tableColumns.channelHandoff,
      id: "channelHandoff",
      meta: { label: copy.tableColumns.channelHandoff } satisfies RunTableColumnMeta,
    },
    {
      accessorFn: (run) => run.nextRecommendedCommand ?? "Generate evidence",
      cell: ({ row }) => <RunNextActionCell run={row.original} />,
      header: copy.tableColumns.nextAction,
      id: "nextAction",
      meta: { label: copy.tableColumns.nextAction } satisfies RunTableColumnMeta,
    },
    {
      cell: ({ row }) => <RunSummaryRowActions run={row.original} />,
      enableHiding: false,
      enableSorting: false,
      header: copy.tableColumns.actions,
      id: "actions",
      meta: { label: copy.tableColumns.actions } satisfies RunTableColumnMeta,
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

export function runColumnLabel(meta: unknown, locale: StudioLocale): string {
  if (meta && typeof meta === "object" && "label" in meta && typeof meta.label === "string") {
    return meta.label;
  }
  return runQueueCopy(locale).allColumns;
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
