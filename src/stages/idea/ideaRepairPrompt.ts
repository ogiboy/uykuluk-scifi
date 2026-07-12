/** Renders a bounded fresh-slate repair prompt from safe idea-validation summaries. */
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
    "## Diversity lane pool",
    "Choose exactly eight distinct lanes from this pool. Skip any lane that resembles a title in history or validation feedback; do not add a `lane` field.",
    ...repairLanePoolLines(validationErrors),
    "## Strict repair rules",
    'Return one JSON object only: `{ "ideas": [...] }` with exactly 8 ideas and the required keys from the base planner contract.',
    "Use every selected lane exactly once. Invent a fresh two-to-five-word Turkish title for every idea.",
    "Lane labels are semantic boundaries, not title templates. Do not copy a lane label verbatim as a title.",
    "Every title listed in Recent UykulukSciFi Idea History or validation feedback is a hard prohibition, whether approved or merely generated. Do not lightly rename one.",
    "Forbidden high-collision title roots in repaired titles: `Uyku`, `Yıldız`, `Yildiz`, `Karanlık`, `Karanlik`, `Mesaj`, `Gezegen`.",
    "If validation feedback names a repeated motif, that motif is forbidden in every repaired title.",
    "Every title must be anchored to a lane-specific artifact, place, or dilemma; do not use generic astronomy titles.",
    "Every premise must use a different protagonist, setting, central object, conflict, and discovery pattern.",
    "Every fit explanation must be unique and lane-specific; mention that lane's concrete visual promise instead of reusing a generic UykulukSciFi sentence.",
    "The only channel name is UykulukSciFi. Never describe a topic, title, lane, object, or place as a channel.",
    "Do not use English scientific leftovers with Turkish suffixes, such as `anomaly’sı`; use Turkish terms like `anomali`, `sapma`, or `belirsiz ölçüm`.",
    "Do not repeat four-word sentence frames across three or more `fit` explanations.",
    "Do not repeat generic fit boilerplate such as `bilimsel soruları`, `doğasıyla uyumludur`, `etik dilemleri`, or `bilimsel sınırı aşan`; state a concrete channel value for each slot.",
    "Do not begin more than one premise with the same first three words; especially avoid repeating `Bir uzay gemisindeki bilim insanları`, `Uzak bir`, or `Gelecekte`.",
    "Do not use `Belki bu` in more than one premise; vary uncertainty with `varsayalım`, `henüz açıklanmamış`, `kesin kanıt değildir`, or a direct cautious question.",
    "Do not repeat generic unknown-species boilerplate such as `bilinmeyen bir tür`, `izlerini saklıyor`, or `varlığına dair ipucu`; make each uncertainty specific to the forced slot.",
    "Do not repeat weak action boilerplate such as `bilgiyi bulduktan sonra` or `anlamaya çalışır`; each premise needs a different concrete action.",
    "Do not reuse weak journey or clue boilerplate such as `anlamak için yola çıkar`, `hakkında ipuçları içeriyor`, `incelemeyi öngörür`, `inceleyerek`, `yansıtmakta`, or repeated `gösteriyor olabilir mi`; use concrete slot-specific observation and review value instead.",
    "no five-word phrase may appear in three or more premises.",
    "Keep UykulukSciFi spelling exact and keep every operator-facing value Turkish.",
    "Do not include markdown, commentary, raw analysis, <think> blocks, or the rejected draft.",
    "## Base planner contract",
    originalPrompt,
    "## Final repair checklist",
    "Before returning JSON, internally verify: 8 ideas; 8 distinct selected lanes; no history or feedback title collision; no forbidden title roots; no repeated title motif; no repeated premise frame; no repeated fit frame; no repeated `Belki bu`; no repeated unknown-species boilerplate; no repeated weak journey/clue/action boilerplate; Turkish-only fields; scientific caution; exact UykulukSciFi spelling.",
  ].join("\n\n");
}

const ideaRepairLanePool = [
  "ışıksız başıboş dünya iklimi",
  "yörünge yaşam alanı ekolojisi",
  "güneş yelkeni arızası",
  "kuyrukluyıldız arşivi",
  "yoğun nötron kalıntısı yakınında yön bulma",
  "Ay lav tüneli yerleşimi",
  "uzak keşif sondası arkeolojisi",
  "kara delik çevresinde zaman farkı",
  "asteroit madeninde sentetik biyoloji",
  "yapay zekâ belleği etiği",
  "öteuydu gelgitleri",
  "terk edilmiş uzay asansörü",
  "manyetosfer krizi",
  "kuşak gemisinde dil değişimi",
  "karanlık madde gözlemevi belirsizliği",
  "uzak koloniler arası iletişim gecikmesi",
] as const;

function repairLanePoolLines(validationErrors: readonly string[]): string[] {
  const historicalTitles = validationErrors.flatMap(historicalTitlesFromValidationError);
  const availableLanes = ideaRepairLanePool.filter(
    (lane) => !historicalTitles.some((title) => laneConflictsWithTitle(lane, title)),
  );
  const excludedCount = ideaRepairLanePool.length - availableLanes.length;
  return [
    ...(excludedCount > 0
      ? [`${excludedCount} history-conflicting lane(s) were removed from this repair pool.`]
      : []),
    ...availableLanes.map((lane) => `- ${lane}`),
  ];
}

function historicalTitlesFromValidationError(error: string): string[] {
  return Array.from(
    error.matchAll(/Repeats previously (?:approved|generated) idea "([^"]+)"/gu),
    (match) => match[1],
  );
}

function laneConflictsWithTitle(lane: string, title: string): boolean {
  const titleWords = new Set(repairContentWords(title));
  return repairContentWords(lane).filter((word) => titleWords.has(word)).length >= 2;
}

function repairContentWords(value: string): string[] {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length >= 4);
}

export function ideasValidationSummary(message: string): string {
  const prefix = "Invalid ideas provider response: ";
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}
