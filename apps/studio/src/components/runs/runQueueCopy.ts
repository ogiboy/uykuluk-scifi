import type { StudioLocale } from "@/i18n/locales";
import type { RunQueueFilter } from "@/lib/runs/runQueueFilters";
import type { RunQueueSort } from "@/lib/runs/runQueueWorkbench";

type RunQueueCopy = Readonly<{
  allColumns: string;
  cliOnly: string;
  columns: string;
  createEpisode: string;
  emptyFiltered: Readonly<{ heading: string; message: string }>;
  emptyRuns: Readonly<{ heading: string; message: string }>;
  filters: Record<RunQueueFilter, string>;
  hiddenByBlocker: (count: number) => string;
  indexDescription: string;
  indexTitle: string;
  first: string;
  last: string;
  localCoreVerified: string;
  next: string;
  operatorQueue: string;
  page: (current: number, total: number) => string;
  pagination: (first: number, last: number, total: number) => string;
  previous: string;
  queueResultSummary: string;
  resetView: string;
  rows: (visible: number, total: number) => string;
  rowUnit: string;
  rowsPerPage: string;
  searchLabel: string;
  searchPlaceholder: string;
  shown: (count: number) => string;
  sortLabel: string;
  sortBy: (label: string) => string;
  sortPlaceholder: string;
  sorts: Record<RunQueueSort, string>;
  summary: string;
  tableCaption: string;
  tableColumns: Readonly<Record<string, string>>;
  tableEmpty: string;
  tableFallback: string;
  title: string;
  tune: Readonly<{
    compact: string;
    comfortable: string;
    density: string;
    localOnly: string;
    maxBlockers: string;
    reviewSurface: string;
    showOnlyUnblocked: (count: number) => string;
    trigger: string;
  }>;
  visibleColumns: string;
  webAction: (count: number) => string;
  blockedCli: (count: number) => string;
  review: (count: number) => string;
}>;

const EN_COPY: RunQueueCopy = {
  allColumns: "Column",
  blockedCli: (count) => `${count} blocked CLI`,
  cliOnly: "CLI-only",
  columns: "Columns",
  createEpisode: "Create episode",
  emptyFiltered: {
    heading: "No runs match this view",
    message: "Change the queue filters or reset the view to see saved production runs.",
  },
  emptyRuns: {
    heading: "No episodes yet",
    message: "Create an episode brief to start the first local production run.",
  },
  filters: {
    all: "All",
    attention: "Needs attention",
    decision: "Needs decision",
    ready: "Ready evidence",
    rendered: "Rendered",
  },
  hiddenByBlocker: (count) => `${count} hidden by blocker limit`,
  indexDescription:
    "A read-only grid over local CLI/core run summaries. Sorting and column visibility do not change a run.",
  indexTitle: "Episode index",
  first: "First",
  last: "Last",
  localCoreVerified: "Local core verified",
  next: "Next",
  operatorQueue: "Operator queue",
  page: (current, total) => `Page ${current} of ${total}.`,
  pagination: (first, last, total) => `Rows ${first}-${last} of ${total}.`,
  previous: "Previous",
  queueResultSummary: "Queue result summary",
  resetView: "Reset view",
  rows: (visible, total) => `${visible} of ${total} rows`,
  rowUnit: "rows",
  rowsPerPage: "Rows per page",
  searchLabel: "Search episodes",
  searchPlaceholder: "episode id, state, readiness, next action",
  shown: (count) => `${count} shown`,
  sortLabel: "Sort queue",
  sortBy: (label) => `Sort by ${label}`,
  sortPlaceholder: "Sort queue",
  sorts: {
    "blocked-first": "Blocked first",
    "decision-first": "Review decision first",
    "oldest-first": "Oldest first",
    "updated-desc": "Newest first",
  },
  summary:
    "Filters are read-only views of persisted CLI/core run summaries. Approvals and render decisions stay on each guarded episode page.",
  tableCaption: "Saved production episodes and their next safe actions",
  tableColumns: {
    actions: "Actions",
    blockedActionCount: "Blocks",
    channelHandoff: "Channel handoff",
    evidenceStatus: "Evidence",
    finalBundle: "Final bundle",
    nextAction: "Next action",
    operatorAction: "Operator action",
    readinessStatus: "Readiness",
    renderDecision: "Render decision",
    runId: "Episode",
    state: "State",
    updatedAt: "Updated",
  },
  tableEmpty: "The current queue view has no rows.",
  tableFallback: "The current queue view changed. Resetting to the first page.",
  title: "Producer runs",
  tune: {
    compact: "Compact",
    comfortable: "Comfortable",
    density: "Table density",
    localOnly:
      "Local view only. These controls never approve, render, upload, or change an episode.",
    maxBlockers: "Maximum blockers shown",
    reviewSurface: "Review surface",
    showOnlyUnblocked: (count) =>
      `Current data reaches ${count}. Set 0 to review only episodes without blockers.`,
    trigger: "Tune review view",
  },
  visibleColumns: "Visible columns",
  webAction: (count) => `${count} web action`,
  review: (count) => `${count} review`,
};

const TR_COPY: RunQueueCopy = {
  ...EN_COPY,
  allColumns: "Sütun",
  blockedCli: (count) => `${count} engelli CLI adımı`,
  cliOnly: "Yalnız CLI",
  columns: "Sütunlar",
  createEpisode: "Bölüm oluştur",
  emptyFiltered: {
    heading: "Bu görünüme uyan bölüm yok",
    message:
      "Kaydedilmiş üretim bölümlerini görmek için filtreleri değiştirin veya görünümü sıfırlayın.",
  },
  emptyRuns: {
    heading: "Henüz bölüm yok",
    message: "İlk yerel üretim çalışmasını başlatmak için bir bölüm brief’i oluşturun.",
  },
  filters: {
    all: "Tümü",
    attention: "İlgi gerekiyor",
    decision: "Karar gerekiyor",
    ready: "Kanıt hazır",
    rendered: "Render edildi",
  },
  hiddenByBlocker: (count) => `${count} bölüm engel limitiyle gizlendi`,
  indexDescription:
    "Yerel CLI/core bölüm özetlerinin salt okunur tablosu. Sıralama ve sütun görünürlüğü bölümü değiştirmez.",
  indexTitle: "Bölüm listesi",
  first: "İlk",
  last: "Son",
  localCoreVerified: "Yerel çekirdek doğrulandı",
  next: "Sonraki",
  operatorQueue: "Operatör kuyruğu",
  page: (current, total) => `Sayfa ${current}/${total}.`,
  pagination: (first, last, total) => `${first}-${last}. satırlar / ${total}.`,
  previous: "Önceki",
  queueResultSummary: "Kuyruk sonuç özeti",
  resetView: "Görünümü sıfırla",
  rows: (visible, total) => `${visible}/${total} satır`,
  rowUnit: "satır",
  rowsPerPage: "Sayfa başına satır",
  searchLabel: "Bölümlerde ara",
  searchPlaceholder: "bölüm kimliği, durum, hazırlık, sonraki adım",
  shown: (count) => `${count} gösteriliyor`,
  sortLabel: "Kuyruğu sırala",
  sortBy: (label) => `${label} sütununa göre sırala`,
  sortPlaceholder: "Kuyruğu sırala",
  sorts: {
    "blocked-first": "Engelliler önce",
    "decision-first": "İnceleme kararı önce",
    "oldest-first": "En eskiler önce",
    "updated-desc": "En yeniler önce",
  },
  summary:
    "Filtreler, kalıcı CLI/core bölüm özetlerinin salt okunur görünümleridir. Onaylar ve render kararları korumalı bölüm sayfasında kalır.",
  tableCaption: "Kaydedilmiş üretim bölümleri ve güvenli sonraki adımları",
  tableColumns: {
    actions: "İşlemler",
    blockedActionCount: "Engeller",
    channelHandoff: "Kanal aktarımı",
    evidenceStatus: "Kanıt",
    finalBundle: "Final paketi",
    nextAction: "Sonraki adım",
    operatorAction: "Operatör işlemi",
    readinessStatus: "Hazırlık",
    renderDecision: "Render kararı",
    runId: "Bölüm",
    state: "Durum",
    updatedAt: "Güncelleme",
  },
  tableEmpty: "Geçerli kuyruk görünümünde satır yok.",
  tableFallback: "Geçerli kuyruk görünümü değişti. İlk sayfaya dönülüyor.",
  title: "Üretim bölümleri",
  tune: {
    compact: "Sıkı",
    comfortable: "Rahat",
    density: "Tablo yoğunluğu",
    localOnly:
      "Yalnız yerel görünüm. Bu kontroller bölüm onaylamaz, render etmez, yüklemez veya değiştirmez.",
    maxBlockers: "Gösterilen en fazla engel",
    reviewSurface: "İnceleme görünümü",
    showOnlyUnblocked: (count) =>
      `Geçerli veride en fazla ${count} engel var. Yalnız engelsiz bölümleri incelemek için 0 seçin.`,
    trigger: "İnceleme görünümünü ayarla",
  },
  visibleColumns: "Görünür sütunlar",
  webAction: (count) => `${count} web işlemi`,
  review: (count) => `${count} inceleme`,
};

/** Returns complete queue, table, and display-tuning copy for the active Studio locale. */
export function runQueueCopy(locale: StudioLocale): RunQueueCopy {
  return locale === "tr" ? TR_COPY : EN_COPY;
}
