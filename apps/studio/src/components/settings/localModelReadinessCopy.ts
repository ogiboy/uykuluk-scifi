import type { StudioLocale } from "@/i18n/locales";

export type LocalModelCopy = {
  readonly actionStatus: Readonly<
    Record<"blocked" | "error" | "idle" | "submitting" | "success", string>
  >;
  readonly advanced: string;
  readonly approveAndQueue: string;
  readonly approvedBy: string;
  readonly binding: string;
  readonly confirmExecution: string;
  readonly cost: string;
  readonly description: string;
  readonly disk: string;
  readonly diskEstimate: string;
  readonly downloaded: string;
  readonly downloading: string;
  readonly duration: string;
  readonly elapsed: string;
  readonly executeIdle: string;
  readonly executing: string;
  readonly executionBlocked: string;
  readonly executionFailed: string;
  readonly executionQueued: string;
  readonly failed: string;
  readonly free: string;
  readonly installing: string;
  readonly interrupted: string;
  readonly interruptedGuidance: string;
  readonly latestOperation: string;
  readonly latestDiagnostic: string;
  readonly latestResult: string;
  readonly model: string;
  readonly noCost: string;
  readonly notInstalled: string;
  readonly notInstalledGuidance: string;
  readonly operationActive: string;
  readonly operationSafeToLeave: string;
  readonly package: string;
  readonly preflightBlocked: string;
  readonly preflightDescription: string;
  readonly preflightFailed: string;
  readonly preflightReady: string;
  readonly preflightTitle: string;
  readonly prepareIdle: string;
  readonly preparing: string;
  readonly progress: string;
  readonly progressUnknown: string;
  readonly queued: string;
  readonly queuedGuidance: string;
  readonly ready: string;
  readonly readyGuidance: string;
  readonly recoverAndReview: string;
  readonly recoveryRequired: string;
  readonly requiredDescription: string;
  readonly requiredTitle: string;
  readonly reviewInstall: string;
  readonly reviewSmoke: string;
  readonly runtime: string;
  readonly runtimePath: string;
  readonly modelPath: string;
  readonly title: string;
  readonly verifying: string;
  readonly failedGuidance: string;
  readonly runningGuidance: string;
  readonly verifyRuntime: string;
};

/**
 * Selects the localized copy for the specified locale.
 *
 * @param locale - The locale used to select the copy.
 * @returns The Turkish copy for `tr`; English copy for all other locales.
 */
export function localModelCopy(locale: StudioLocale): LocalModelCopy {
  return locale === "tr" ? turkishCopy : englishCopy;
}

const turkishCopy: LocalModelCopy = {
  actionStatus: {
    blocked: "engellendi",
    error: "hata",
    idle: "bekliyor",
    submitting: "gönderiliyor",
    success: "başarılı",
  },
  advanced: "Gelişmiş tanılar",
  approveAndQueue: "Onayla ve kuyrukla",
  approvedBy: "Onaylayan",
  binding: "Preflight bağ özeti",
  confirmExecution:
    "Bu tam disk ve süre tahminini inceledim; yalnız bu hazırlanan MFLUX işlemini kuyruğa almayı onaylıyorum.",
  cost: "Maliyet",
  description:
    "Yerel görsel üretim için MFLUX çalışma zamanını ve sabit FLUX.2 Klein model paketini yönetir.",
  disk: "Disk ihtiyacı",
  diskEstimate: "yaklaşık 6,5 GB",
  downloaded: "İndirilen",
  downloading: "Model indiriliyor",
  duration: "Tahmini süre",
  elapsed: "Geçen süre",
  executeIdle: "Onaylanan yerel model işlemi bekliyor.",
  executing: "Onaylanan MFLUX işlemi kuyruğa alınıyor...",
  executionBlocked: "Yerel model işlemi engellendi",
  executionFailed: "Studio onaylanan yerel model işlemini kuyruğa alamadı.",
  executionQueued: "Yerel model işlemi kuyrukta; durum bu sayfada yenilenecek.",
  failed: "Başarısız",
  free: "$0",
  installing: "Kuruluyor",
  interrupted: "Kesintiye uğradı",
  interruptedGuidance:
    "Önceki worker tamamlanmadı. Kesintiyi kaydedip yeni, açıkça onaylanacak kurulum planını inceleyin.",
  latestOperation: "Son işlem",
  latestDiagnostic: "Son tanı",
  latestResult: "Son yerel işlem sonucu",
  model: "Model",
  noCost: "Yerel · $0",
  notInstalled: "Yüklü değil",
  notInstalledGuidance: "Gerçek yerel üretim için sabit MFLUX kurulum planını inceleyin.",
  operationActive: "Yerel model işlemi sürüyor",
  operationSafeToLeave:
    "Bu sayfadan güvenle ayrılabilirsiniz; işlem ve kanıtlar yerel çalışma alanında kalıcıdır.",
  package: "Paket",
  preflightBlocked: "Yerel model preflight engellendi",
  preflightDescription:
    "İndirme veya çalışma zamanı kurulumu, yalnız bu değiştirilemez planın açık onayından sonra başlar.",
  preflightFailed: "Studio yerel model preflight kaydını oluşturamadı.",
  preflightReady: "Preflight hazır; disk, süre ve bağ özetini inceleyin.",
  preflightTitle: "İncelenmeye hazır yerel işlem",
  prepareIdle: "Yerel model hazırlığı henüz oluşturulmadı.",
  preparing: "Yerel MFLUX preflight hazırlanıyor...",
  progress: "İlerleme",
  progressUnknown: "Çalışma zamanı aşaması bildiriliyor; bayt ilerlemesi henüz kullanılamıyor.",
  queued: "Kuyrukta",
  queuedGuidance: "Onaylanan işlem yerel worker tarafından alınmayı bekliyor.",
  ready: "Hazır",
  readyGuidance: "Yerel MFLUX seçilen sahneler için gerçek görsel üretebilir.",
  recoverAndReview: "Kesintiyi kurtar ve yeni planı incele",
  recoveryRequired: "Operatör kurtarması gerekli",
  requiredDescription:
    "Gerçek, ücretsiz ve credential-free yerel görsel üretimi için MFLUX gereklidir. Mock tanı ve manuel içe aktarma alternatif iş akışlarıdır; yerel model çıktısı değildir.",
  requiredTitle: "MFLUX gerçek yerel görsel üretimi için zorunludur",
  reviewInstall: "Kurulum planını incele",
  reviewSmoke: "Smoke tanı planını incele",
  runtime: "Çalışma zamanı",
  runtimePath: "Yerel çalışma zamanı yolu",
  modelPath: "Yerel model yolu",
  title: "Yerel Modeller",
  verifying: "Doğrulanıyor",
  failedGuidance:
    "Son işlem başarısız oldu. Tanıyı inceleyip yeni bir kurulum veya doğrulama planı oluşturun.",
  runningGuidance: "Çalışan yerel worker tamamlanana kadar yeni işlem başlatılamaz.",
  verifyRuntime: "Doğrulama planını incele",
};

const englishCopy: LocalModelCopy = {
  actionStatus: {
    blocked: "blocked",
    error: "error",
    idle: "idle",
    submitting: "submitting",
    success: "success",
  },
  advanced: "Advanced diagnostics",
  approveAndQueue: "Approve and queue",
  approvedBy: "Approved by",
  binding: "Preflight binding digest",
  confirmExecution:
    "I reviewed this exact disk and duration estimate and approve queuing only this prepared MFLUX operation.",
  cost: "Cost",
  description:
    "Manages the MFLUX runtime and pinned FLUX.2 Klein package for local image generation.",
  disk: "Disk requirement",
  diskEstimate: "about 6.5 GB",
  downloaded: "Downloaded",
  downloading: "Downloading model",
  duration: "Estimated duration",
  elapsed: "Elapsed",
  executeIdle: "Approved local model operation is waiting.",
  executing: "Queuing the approved MFLUX operation...",
  executionBlocked: "Local model operation blocked",
  executionFailed: "Studio could not queue the approved local model operation.",
  executionQueued: "Local model operation is queued; this page will refresh its status.",
  failed: "Failed",
  free: "$0",
  installing: "Installing",
  interrupted: "Interrupted",
  interruptedGuidance:
    "The previous worker did not finish. Record the interruption, then review a new explicitly approved setup plan.",
  latestOperation: "Latest operation",
  latestDiagnostic: "Latest diagnostic",
  latestResult: "Latest local operation result",
  model: "Model",
  noCost: "Local · $0",
  notInstalled: "Not installed",
  notInstalledGuidance: "Review the pinned MFLUX setup plan to enable real local generation.",
  operationActive: "Local model operation is active",
  operationSafeToLeave:
    "You can safely leave this page; the operation and its evidence persist in the local workspace.",
  package: "Package",
  preflightBlocked: "Local model preflight blocked",
  preflightDescription:
    "The download or runtime setup starts only after an explicit approval of this immutable plan.",
  preflightFailed: "Studio could not create the local model preflight record.",
  preflightReady: "Preflight is ready; review its disk, duration, and binding digest.",
  preflightTitle: "Local operation ready for review",
  prepareIdle: "No local model preparation has been created yet.",
  preparing: "Preparing the local MFLUX preflight...",
  progress: "Progress",
  progressUnknown: "The runtime phase is reported; byte progress is not available yet.",
  queued: "Queued",
  queuedGuidance: "The approved operation is waiting for the local worker to claim it.",
  ready: "Ready",
  readyGuidance: "Local MFLUX can generate real images for selected scenes.",
  recoverAndReview: "Recover interruption and review a new plan",
  recoveryRequired: "Operator recovery required",
  requiredDescription:
    "MFLUX is required for real, free, credential-free local image generation. Mock diagnostics and manual import are alternative workflows, not local-model output.",
  requiredTitle: "MFLUX is required for real local image generation",
  reviewInstall: "Review installation plan",
  reviewSmoke: "Review smoke diagnostic plan",
  runtime: "Runtime",
  runtimePath: "Local runtime path",
  modelPath: "Local model path",
  title: "Local Models",
  verifying: "Verifying",
  failedGuidance:
    "The last operation failed. Review its diagnostic, then create a new setup or verification plan.",
  runningGuidance: "No new operation can start until the active local worker finishes.",
  verifyRuntime: "Review verification plan",
};
