export function renderIdeaRepairPrompt(
  originalPrompt: string,
  validationErrorInput: string | string[],
): string {
  const validationErrors = Array.isArray(validationErrorInput)
    ? validationErrorInput
    : [validationErrorInput];
  const summary = validationErrors.map(ideasValidationSummary).join("\n- ");
  return [
    "IDEA_REPAIR_JSON",
    "## Repair objective",
    `The previous idea response was rejected before artifact persistence:\n- ${summary}`,
    "Do not reuse or revise the rejected draft. Generate a fresh complete idea slate.",
    "## Forced diversity slots",
    "Return the eight ideas in this exact slot order; do not add a `lane` or `slot` field.",
    "1. buzaltı okyanusu anomalisi — title anchor: Buzaltı Haritası — premise opener: Bir denizbilimci sonda",
    "2. ötegezegen jeolojisi — title anchor: Lav Kütüphanesi — premise opener: Genç bir jeolog",
    "3. kuşak gemisi ikilemi — title anchor: Tohum Gemisi Bahçesi — premise opener: Kuşak gemisinde büyüyen bir arşivci",
    "4. insan-sonrası arkeoloji — title anchor: Paslı Android Mezarlığı — premise opener: Ay yüzeyinde çalışan bir kazı ekibi",
    "5. yörünge arşivi — title anchor: Yörünge Teybi — premise opener: Eski bir istasyon teknisyeni",
    "6. gezegen-dönüştürme etiği — title anchor: Kızıl Toz Sözleşmesi — premise opener: Mars danışma kurulundaki bir biyolog",
    "7. zaman gecikmeli sinyal — title anchor: Nötrino Gecikmesi — premise opener: Derin uzay dinleme ekibindeki bir matematikçi",
    "8. otonom sonda — title anchor: Sonda Günlüğü — premise opener: Otonom bir keşif sondası",
    "## Strict repair rules",
    'Return one JSON object only: `{ "ideas": [...] }` with exactly 8 ideas and the required keys from the base planner contract.',
    "Use each forced slot exactly once. Each title must use its slot title anchor as the main concrete noun phrase.",
    "Forbidden high-collision title roots in repaired titles: `Uyku`, `Yıldız`, `Yildiz`, `Karanlık`, `Karanlik`, `Mesaj`, `Gezegen`.",
    "If validation feedback names a repeated motif, that motif is forbidden in every repaired title.",
    "Every title must be anchored to a lane-specific artifact, place, or dilemma; do not use generic astronomy titles.",
    "Every premise must use a different protagonist, setting, central object, conflict, and discovery pattern.",
    "Every fit explanation must be unique and slot-specific; mention that slot's concrete title anchor or visual promise instead of reusing a generic UykulukSciFi sentence.",
    "Do not repeat four-word sentence frames across three or more `fit` explanations.",
    "Do not repeat generic fit boilerplate such as `bilimsel soruları`, `doğasıyla uyumludur`, `etik dilemleri`, or `bilimsel sınırı aşan`; state a concrete channel value for each slot.",
    "Do not begin more than one premise with the same first three words; especially avoid repeating `Bir uzay gemisindeki bilim insanları`, `Uzak bir`, or `Gelecekte`.",
    "Do not use `Belki bu` in more than one premise; vary uncertainty with `varsayalım`, `henüz açıklanmamış`, `kesin kanıt değildir`, or a direct cautious question.",
    "Do not repeat generic unknown-species boilerplate such as `bilinmeyen bir tür`, `izlerini saklıyor`, or `varlığına dair ipucu`; make each uncertainty specific to the forced slot.",
    "Do not repeat weak action boilerplate such as `bilgiyi bulduktan sonra` or `anlamaya çalışır`; each premise needs a different concrete action.",
    "no five-word phrase may appear in three or more premises.",
    "Keep UykulukSciFi spelling exact and keep every operator-facing value Turkish.",
    "Do not include markdown, commentary, raw analysis, <think> blocks, or the rejected draft.",
    "## Base planner contract",
    originalPrompt,
    "## Final repair checklist",
    "Before returning JSON, internally verify: 8 ideas; 8 forced slots; no forbidden title roots; no repeated title motif; no repeated premise frame; no repeated fit frame; no repeated `Belki bu`; no repeated unknown-species boilerplate; no repeated weak action boilerplate; Turkish-only fields; scientific caution; exact UykulukSciFi spelling.",
  ].join("\n\n");
}

export function ideasValidationSummary(message: string): string {
  const prefix = "Invalid ideas provider response: ";
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}
