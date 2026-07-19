import type { StudioLocale } from "../../../i18n/locales";
import * as labels from "./visualRevisionGalleryCopy";
export type VisualReviewCopy = Readonly<{
  activateBlocked: string;
  activateFallback: string;
  activateImpact: string;
  activateSubmitting: (revision: number, scene: number) => string;
  activateSuccess: (revision: number, scene: number) => string;
  activateTitle: string;
  activeRevisions: string;
  advancedEvidence: string;
  advancedManifest: string;
  approval: string;
  approveSelected: (count: number) => string;
  asset: string;
  beat: (scene: number) => string;
  canonicalSelection: string;
  clear: string;
  confirmHosted: (model: string, count: number, cost: string) => string;
  credentialConfigured: string;
  credentialMissing: string;
  credentialPresentHint: string;
  credentialRequiredHint: string;
  decisionBlocked: string;
  decisionFallback: string;
  decisionSubmitting: (status: string, count: number) => string;
  decisionSuccess: (status: string, count: number) => string;
  decisionTitle: string;
  dimensions: string;
  generateApproved: string;
  generateHostedBlocked: string;
  generateHostedFallback: string;
  generateHostedSubmitting: string;
  generateHostedSuccess: string;
  generateHostedTitle: string;
  hostedBlocked: string;
  hostedDescription: string;
  hostedEvidenceBlocked: string;
  hostedIdentity: string;
  hostedMixedSelection: string;
  hostedNeedsAttribution: string;
  hostedPurposeLabel: (
    purpose: "initial" | "regenerate-rejected" | null | undefined,
    fallback: string,
  ) => string;
  hostedPlanBlocked: string;
  hostedPlanFallback: string;
  hostedPlanReady: string;
  hostedPlanSubmitting: (count: number, revising: boolean) => string;
  hostedSelectionBlocked: string;
  hostedStatusLabel: (status: string) => string;
  hostedTitle: string;
  imageNotAccepted: string;
  importBlocked: string;
  importFallback: string;
  importNewRevision: string;
  importSubmitting: (scene: number) => string;
  importSuccess: (scene: number) => string;
  importTitle: string;
  invalidEvidence: string;
  latestActionTitle: string;
  manifestDigest: string;
  model: string;
  newPlan: string;
  notesLabel: string;
  notesPlaceholder: string;
  panelDescription: string;
  panelTitle: string;
  plan: string;
  planBinding: string;
  planSelected: string;
  prepareAction: string;
  prepareBlocked: string;
  prepareFallback: string;
  prepareSubmitting: string;
  prepareSuccess: string;
  prepareTitle: string;
  provider: string;
  purpose: string;
  quote: string;
  quotedCap: string;
  regenerateRejected: (count: number) => string;
  regenerationBlocked: string;
  regenerationFallback: string;
  regenerationSubmitting: (count: number) => string;
  regenerationSuccess: (count: number) => string;
  regenerationTitle: string;
  rejectSelected: string;
  replacementImage: (scene: number) => string;
  revision: (revision: number) => string;
  revisionHistory: string;
  reviewerLabel: string;
  reviewerPlaceholder: string;
  scenes: string;
  selectAll: string;
  selectBeat: (scene: number) => string;
  selectPending: string;
  selectRejected: string;
  status: Readonly<Record<"approved" | "pending" | "rejected", string>>;
  summaryInvalid: string;
  summaryMissing: string;
  summaryStatus: Readonly<Record<"invalid" | "missing" | "ready", string>>;
  summary: (approved: number, total: number, rejected: number) => string;
  updated: string;
  visualActionStatusLabel: (
    kind: "blocked" | "error" | "idle" | "submitting" | "success",
  ) => string;
}>;

type VisualReviewTextCopy = Omit<
  VisualReviewCopy,
  "hostedPurposeLabel" | "hostedStatusLabel" | "visualActionStatusLabel"
>;

/** Returns locale-bound visual-review copy and status-label helpers. */
export function visualReviewCopy(locale: StudioLocale): VisualReviewCopy {
  return {
    ...(locale === "tr" ? turkishCopy : englishCopy),
    hostedPurposeLabel: labels.hostedVisualPurposeLabel.bind(undefined, locale),
    hostedStatusLabel: labels.hostedVisualStatusLabel.bind(undefined, locale),
    visualActionStatusLabel: labels.visualActionStatusLabel.bind(undefined, locale),
  };
}
const englishCopy: VisualReviewTextCopy = {
  activateBlocked: "Visual revision selection blocked",
  activateFallback: "Studio could not make this visual revision canonical.",
  activateImpact:
    "Changing the canonical revision clears its review and invalidates downstream render evidence.",
  activateSubmitting: (revision, scene) =>
    `Making revision ${revision} canonical for visual beat ${scene}...`,
  activateSuccess: (revision, scene) =>
    `Revision ${revision} is canonical for beat ${scene}; review it again before rendering.`,
  activateTitle: "Visual revision selected",
  activeRevisions: "Active revisions",
  advancedEvidence: "Advanced evidence",
  advancedManifest: "Advanced manifest evidence",
  approval: "Approval",
  approveSelected: (count) => `Approve selected (${count})`,
  asset: "Asset",
  beat: (scene) => `Beat ${scene}`,
  canonicalSelection: "Canonical revision change",
  clear: "Clear",
  confirmHosted: (model, count, cost) =>
    `I confirm ${model} for ${count} scene(s) with a maximum quoted batch cost of $${cost}.`,
  credentialConfigured: "credential configured",
  credentialMissing: "credential missing",
  credentialPresentHint:
    "Credential presence only. Balance, entitlement, usage rights, and provider availability are confirmed only by the provider response.",
  credentialRequiredHint:
    "A new hosted request needs a server-side credential. Recovery of a committed result does not resend the provider request.",
  decisionBlocked: "Visual decision blocked",
  decisionFallback: "Studio could not record the visual decision.",
  decisionSubmitting: (status, count) => `Recording ${status} for ${count} visual beats...`,
  decisionSuccess: (status, count) => `Recorded ${status} for ${count} visual beats.`,
  decisionTitle: "Visual decision recorded",
  dimensions: "Dimensions",
  generateApproved: "Generate approved scene images",
  generateHostedBlocked: "Hosted visual generation blocked",
  generateHostedFallback: "Studio could not execute the approved hosted visual batch.",
  generateHostedSubmitting: "Generating the exact approved hosted visual batch...",
  generateHostedSuccess: "Hosted scene images were settled and opened for visual review.",
  generateHostedTitle: "Hosted visuals generated",
  hostedBlocked: "Hosted visual configuration is blocked",
  hostedDescription:
    "Select beats, persist one exact provider plan, then use the normal cost approval step. Rejected hosted beats reopen as attributed revisions.",
  hostedEvidenceBlocked: "Hosted visual evidence is blocked",
  hostedIdentity: "Exact paid-operation identity",
  hostedMixedSelection:
    "This state accepts only rejected beats backed by exact settled hosted evidence. Remove pending, approved, static, or manual beats.",
  hostedNeedsAttribution:
    "Add reviewer attribution and revision notes before planning rejected hosted beats.",
  hostedPlanBlocked: "Hosted visual plan blocked",
  hostedPlanFallback: "Studio could not persist the selected hosted visual plan.",
  hostedPlanReady: "Hosted visual plan persisted. Continue with estimate and approval.",
  hostedPlanSubmitting: (count, revising) =>
    revising
      ? `Archiving prior evidence and planning ${count} rejected visual beats...`
      : `Binding ${count} visual beats to an exact hosted plan...`,
  hostedSelectionBlocked: "Hosted visual selection blocked",
  hostedTitle: "Hosted scene generation",
  imageNotAccepted: "Image not accepted",
  importBlocked: "Visual import blocked",
  importFallback: "Studio could not import the visual revision.",
  importNewRevision: "Import as new revision",
  importSubmitting: (scene) => `Importing visual beat ${scene}...`,
  importSuccess: (scene) => `Visual beat ${scene} has a new pending revision.`,
  importTitle: "Visual revision imported",
  invalidEvidence: "Visual evidence cannot be trusted",
  latestActionTitle: "Latest visual action",
  manifestDigest: "Manifest digest",
  model: "Model",
  newPlan: "new plan",
  notesLabel: "Visual review notes",
  notesPlaceholder: "Record why these beats pass or need revision.",
  panelDescription:
    "Review 12-24 episode-specific visual beats, replace only weak scenes, then bind approved revisions into the exact render plan.",
  panelTitle: "Scene Visual Review",
  plan: "Plan",
  planBinding: "Plan binding",
  planSelected: "Plan selected",
  prepareAction: "Prepare 12-24 visual beats",
  prepareBlocked: "Visual preparation blocked",
  prepareFallback: "Studio could not prepare scene visuals.",
  prepareSubmitting: "Preparing deterministic scene visuals...",
  prepareSuccess: "Scene visuals are ready for review.",
  prepareTitle: "Visuals prepared",
  provider: "Provider",
  purpose: "Purpose",
  quote: "Quote",
  quotedCap: "Quoted batch cap",
  regenerateRejected: (count) => `Regenerate rejected (${count})`,
  regenerationBlocked: "Visual regeneration blocked",
  regenerationFallback: "Studio could not regenerate the rejected visual beats.",
  regenerationSubmitting: (count) => `Regenerating ${count} rejected visual beats...`,
  regenerationSuccess: (count) =>
    `Regenerated ${count} rejected visual beats as pending revisions.`,
  regenerationTitle: "Rejected visuals regenerated",
  rejectSelected: "Reject selected",
  replacementImage: (scene) => `Replacement image for visual beat ${scene}`,
  revision: (revision) => `revision ${revision}`,
  revisionHistory: "Revision history",
  reviewerLabel: "Visual reviewer",
  reviewerPlaceholder: "Reviewer",
  scenes: "Scenes",
  selectAll: "Select all",
  selectBeat: (scene) => `Select visual beat ${scene}`,
  selectPending: "Select pending",
  selectRejected: "Select rejected",
  status: { approved: "approved", pending: "pending", rejected: "rejected" },
  summaryInvalid: "Visual evidence is invalid. Open Advanced evidence for the recorded diagnostic.",
  summaryMissing: "Prepare the episode-specific visual beats to begin contact-sheet review.",
  summaryStatus: { invalid: "invalid", missing: "not prepared", ready: "ready" },
  summary: (approved, total, rejected) =>
    `${approved}/${total} visual beats approved; ${rejected} rejected.`,
  updated: "Updated",
};

const turkishCopy: VisualReviewTextCopy = {
  ...englishCopy,
  activateBlocked: "Görsel revizyon seçimi engellendi",
  activateFallback: "Studio bu görsel revizyonu kanonik yapamadı.",
  activateImpact:
    "Kanonik revizyonu değiştirmek sahne onayını temizler ve aşağı akış render kanıtını geçersiz kılar.",
  activateSubmitting: (revision, scene) =>
    `Revizyon ${revision}, görsel beat ${scene} için kanonik yapılıyor...`,
  activateSuccess: (revision, scene) =>
    `Revizyon ${revision}, beat ${scene} için kanonik; render öncesinde yeniden inceleyin.`,
  activateTitle: "Görsel revizyon seçildi",
  activeRevisions: "Etkin revizyonlar",
  advancedEvidence: "Gelişmiş kanıt",
  advancedManifest: "Gelişmiş manifest kanıtı",
  approval: "Onay",
  approveSelected: (count) => `Seçilenleri onayla (${count})`,
  asset: "Varlık",
  beat: (scene) => `Beat ${scene}`,
  canonicalSelection: "Kanonik revizyon değişikliği",
  clear: "Temizle",
  confirmHosted: (model, count, cost) =>
    `${model} ile ${count} sahne için en fazla $${cost} tutarındaki toplu teklifi onaylıyorum.`,
  credentialConfigured: "credential yapılandırılmış",
  credentialMissing: "credential eksik",
  credentialPresentHint:
    "Credential varlığı yalnız bir yapılandırma sinyalidir. Bakiye, yetki, kullanım hakkı ve erişilebilirlik provider yanıtıyla doğrulanır.",
  credentialRequiredHint:
    "Yeni hosted istek server-side credential gerektirir. Kaydedilmiş sonuç kurtarması provider isteğini yeniden göndermez.",
  decisionBlocked: "Görsel kararı engellendi",
  decisionFallback: "Studio görsel kararını kaydedemedi.",
  decisionSubmitting: (status, count) =>
    `${count} görsel beat için ${status} kararı kaydediliyor...`,
  decisionSuccess: (status, count) => `${count} görsel beat için ${status} kararı kaydedildi.`,
  decisionTitle: "Görsel kararı kaydedildi",
  dimensions: "Boyutlar",
  generateApproved: "Onaylanan sahne görsellerini üret",
  generateHostedBlocked: "Bulut görsel üretimi engellendi",
  generateHostedFallback: "Studio onaylanan bulut görsel grubunu üretemedi.",
  generateHostedSubmitting: "Kesin olarak onaylanan bulut görsel grubu üretiliyor...",
  generateHostedSuccess: "Bulut sahne görselleri uzlaştırıldı ve incelemeye açıldı.",
  generateHostedTitle: "Bulut görselleri üretildi",
  hostedBlocked: "Hosted görsel yapılandırması engellendi",
  hostedDescription:
    "Beat'leri seçin, tek ve kesin provider planını kaydedin, sonra normal maliyet onayını kullanın. Reddedilen hosted beat'ler atıflı revizyon olarak yeniden açılır.",
  hostedEvidenceBlocked: "Hosted görsel kanıtı engellendi",
  hostedIdentity: "Kesin ücretli işlem kimliği",
  hostedMixedSelection:
    "Bu durum yalnız kesin settled hosted kanıtı olan reddedilmiş beat'leri kabul eder. Bekleyen, onaylı, statik veya manuel beat'leri çıkarın.",
  hostedNeedsAttribution:
    "Reddedilen hosted beat'leri planlamadan önce inceleyen ve revizyon notlarını ekleyin.",
  hostedPlanBlocked: "Bulut görsel planı engellendi",
  hostedPlanFallback: "Studio seçilen bulut görsel planını kaydedemedi.",
  hostedPlanReady: "Bulut görsel planı kaydedildi. Tahmin ve onay adımıyla devam edin.",
  hostedPlanSubmitting: (count, revising) =>
    revising
      ? `Önceki kanıt arşivleniyor ve ${count} reddedilmiş görsel beat planlanıyor...`
      : `${count} görsel beat kesin bulut planına bağlanıyor...`,
  hostedSelectionBlocked: "Bulut görsel seçimi engellendi",
  hostedTitle: "Hosted sahne üretimi",
  imageNotAccepted: "Görsel kabul edilmedi",
  importBlocked: "Görsel içe aktarma engellendi",
  importFallback: "Studio görsel revizyonunu içe aktaramadı.",
  importNewRevision: "Yeni revizyon olarak içe aktar",
  importSubmitting: (scene) => `Görsel beat ${scene} içe aktarılıyor...`,
  importSuccess: (scene) => `Görsel beat ${scene} için yeni bekleyen revizyon oluştu.`,
  importTitle: "Görsel revizyon içe aktarıldı",
  invalidEvidence: "Görsel kanıtına güvenilemiyor",
  latestActionTitle: "Son görsel eylemi",
  manifestDigest: "Manifest özeti",
  newPlan: "yeni plan",
  notesLabel: "Görsel inceleme notları",
  notesPlaceholder: "Bu beat'lerin neden geçtiğini veya revizyon istediğini kaydedin.",
  model: "Model",
  panelDescription:
    "Bölüme özgü 12-24 görsel beat'i inceleyin, yalnız zayıf sahneleri değiştirin ve onaylanan revizyonları kesin render planına bağlayın.",
  panelTitle: "Sahne Görsellerini İncele",
  plan: "Plan",
  planSelected: "Seçilenleri planla",
  prepareAction: "12-24 görsel beat hazırla",
  planBinding: "Plan bağı",
  prepareBlocked: "Görsel hazırlığı engellendi",
  prepareFallback: "Studio sahne görsellerini hazırlayamadı.",
  prepareSubmitting: "Deterministik sahne görselleri hazırlanıyor...",
  prepareSuccess: "Sahne görselleri incelemeye hazır.",
  prepareTitle: "Görseller hazırlandı",
  provider: "Provider",
  purpose: "Amaç",
  quotedCap: "Teklif edilen batch üst sınırı",
  regenerateRejected: (count) => `Reddedilenleri yeniden üret (${count})`,
  regenerationBlocked: "Görsel yeniden üretimi engellendi",
  regenerationFallback: "Studio reddedilen görsel beat'leri yeniden üretemedi.",
  quote: "Teklif",
  regenerationSubmitting: (count) => `${count} reddedilmiş görsel beat yeniden üretiliyor...`,
  regenerationSuccess: (count) =>
    `${count} reddedilmiş görsel beat, bekleyen revizyon olarak yeniden üretildi.`,
  regenerationTitle: "Reddedilen görseller yeniden üretildi",
  rejectSelected: "Seçilenleri reddet",
  replacementImage: (scene) => `Görsel beat ${scene} için değişim görseli`,
  revision: (revision) => `revizyon ${revision}`,
  revisionHistory: "Revizyon geçmişi",
  reviewerLabel: "Görsel inceleyen",
  reviewerPlaceholder: "İnceleyen",
  scenes: "Sahneler",
  selectAll: "Tümünü seç",
  selectBeat: (scene) => `Görsel beat ${scene} seç`,
  selectPending: "Bekleyenleri seç",
  selectRejected: "Reddedilenleri seç",
  status: { approved: "onaylandı", pending: "bekliyor", rejected: "reddedildi" },
  summaryInvalid: "Görsel kanıtı geçersiz. Kaydedilen tanı için Gelişmiş kanıt bölümünü açın.",
  summaryMissing:
    "Toplu görsel incelemesini başlatmak için bölüme özgü görsel beat'leri hazırlayın.",
  summaryStatus: { invalid: "geçersiz", missing: "hazırlanmadı", ready: "hazır" },
  summary: (approved, total, rejected) =>
    `${total} görsel beat'in ${approved} tanesi onaylı; ${rejected} tanesi reddedildi.`,
  updated: "Güncellendi",
};
