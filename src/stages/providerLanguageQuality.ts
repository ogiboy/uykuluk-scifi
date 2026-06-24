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
  "brain",
  "broadcast",
  "colony",
  "cosmic",
  "discovers",
  "documentary",
  "during",
  "environment",
  "exploration",
  "human",
  "identity",
  "memory",
  "minute",
  "minutes",
  "narrative",
  "patterns",
  "researcher",
  "scientists",
  "sleep",
  "team",
  "the",
  "visualization",
  "visualizations",
  "with",
]);

export function looksLikeTurkishOperatorText(text: string): boolean {
  const lower = text.toLocaleLowerCase("tr");
  const words = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const turkishMarkers = countKnownWords(words, TURKISH_OPERATOR_MARKERS);
  const englishMarkers = countKnownWords(words, ENGLISH_OPERATOR_MARKERS);
  return turkishMarkers >= 3 && englishMarkers <= turkishMarkers;
}

function countKnownWords(words: string[], markers: ReadonlySet<string>): number {
  return words.filter((word) => markers.has(word)).length;
}
