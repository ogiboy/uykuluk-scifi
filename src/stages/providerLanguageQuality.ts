const TURKISH_OPERATOR_MARKERS = new Set([
  "anlati",
  "anlatı",
  "bilim",
  "bilimkurgu",
  "bilimsel",
  "bir",
  "dakika",
  "dunya",
  "dünya",
  "evren",
  "gezegen",
  "hikaye",
  "icin",
  "ihtiyat",
  "ile",
  "insan",
  "için",
  "kanal",
  "karanlik",
  "karanlık",
  "kesif",
  "keşif",
  "kozmik",
  "merak",
  "nasil",
  "nasıl",
  "neden",
  "olasilik",
  "olasılık",
  "oyku",
  "rüya",
  "ruya",
  "sakin",
  "sessiz",
  "sinematik",
  "temkinli",
  "tonuna",
  "uygun",
  "uyku",
  "uzak",
  "ve",
  "yavas",
  "yavaş",
  "zaman",
  "öykü",
]);

const ENGLISH_OPERATOR_MARKERS = new Set([
  "and",
  "abstract",
  "brain",
  "broadcast",
  "calm",
  "cinematic",
  "colony",
  "cosmic",
  "discovers",
  "documentary",
  "during",
  "environment",
  "exploration",
  "fiction",
  "human",
  "identity",
  "imagery",
  "memory",
  "minute",
  "minutes",
  "narrative",
  "patterns",
  "researcher",
  "science",
  "scientific",
  "scientists",
  "sleep",
  "surreal",
  "team",
  "the",
  "visuals",
  "visualization",
  "visualizations",
  "with",
]);

export function looksLikeTurkishOperatorText(text: string): boolean {
  const words = operatorWords(text);
  const turkishMarkers = countKnownWords(words, TURKISH_OPERATOR_MARKERS);
  const englishMarkers = countKnownWords(words, ENGLISH_OPERATOR_MARKERS);
  return turkishMarkers >= 3 && englishMarkers <= turkishMarkers;
}

export function containsEnglishOperatorMarkers(text: string): boolean {
  return countKnownWords(operatorWords(text), ENGLISH_OPERATOR_MARKERS) > 0;
}

function operatorWords(text: string): string[] {
  const lower = text.toLocaleLowerCase("tr");
  return lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function countKnownWords(words: string[], markers: ReadonlySet<string>): number {
  return words.filter((word) => markers.has(word)).length;
}
