export function renderPreviousExpansionContext(previousChunks: readonly string[]): string {
  if (previousChunks.length === 0) {
    return "";
  }
  return [
    "## Already Written In This Section",
    "Do not repeat these sentences, sentence skeletons, metaphors, or visual directions.",
    "Continue from them with new beats, different nouns/verbs, and a changed visual setup.",
    previousChunks.join("\n\n"),
  ].join("\n\n");
}

export function renderScopedScriptSectionContext(basePrompt: string): string {
  return [
    "You are writing one bounded Turkish script section for UykulukSciFi.",
    "Use a cinematic, calm, scientifically careful, accessible Turkish narration tone.",
    "Treat scientific speculation responsibly and avoid unsupported certainty.",
    "Use Turkish production labels only, such as `Anlatıcı:` and `Görsel:`.",
    "Spell production labels exactly as `Anlatıcı:` and `Görsel:`; do not invent or misspell labels.",
    "Forbidden label variants: `Anlatı:`, `Anlatyıcı:`, `Anlatici:`, `Gorsel:`, `Görsel -`, `Sahne:`, `Kamera:`, `Kes:`.",
    "Do not repeat exact sentences, sentence skeletons, metaphors, or visual directions across the script.",
    "If a previous line used the same structure, replace it with a new beat instead of paraphrasing it.",
    "Do not append compliance checklists, self-evaluations, word/character counts, JSON-completeness notes, or model-quality commentary.",
    "If the approved idea contains an impossible mechanism, frame it as speculative fiction or a question, not established science.",
    "This call writes one bounded section for an 8-12 minute local draft; do not try to complete the whole script in one response.",
    renderExactLabelChecklist(),
    extractApprovedIdeaBlock(basePrompt),
  ].join("\n\n");
}

function renderExactLabelChecklist(): string {
  return [
    "## Exact label checklist",
    "Only `Anlatıcı:` and `Görsel:` are valid labels.",
    "Every label must include Turkish accents exactly as shown.",
    "Never write `Anlatici:`, `Gorsel:`, `Anlatı:`, `Anlatyıcı:`, `Sahne:`, `Kamera:`, or any other colon-prefixed production label.",
    "If unsure which label to use, use `Anlatıcı:`.",
  ].join("\n");
}

function extractApprovedIdeaBlock(basePrompt: string): string {
  const marker = "## Approved Idea";
  const markerIndex = basePrompt.indexOf(marker);
  return markerIndex >= 0 ? basePrompt.slice(markerIndex).trim() : basePrompt.trim();
}
