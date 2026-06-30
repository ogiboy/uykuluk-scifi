export function renderIdeaEvalPrompt(): string {
  return [
    "IDEAS_JSON",
    "Return a production-style slate of 5 to 10 original UykulukSciFi YouTube video ideas in Turkish.",
    "Use the same idea contract as the production ideas stage: distinct titles, concrete premises, careful science framing, no repeated generic premise or fit frames, and exact UykulukSciFi spelling.",
    'Return only JSON with shape {"ideas":[{"title":"...","premise":"...","targetDuration":"8-12 dakika","style":"...","estimatedDifficulty":"low|medium|high","riskLevel":"low|medium|high","fit":"..."}]}.',
  ].join("\n\n");
}

export function renderScriptEvalBasePrompt(): string {
  return [
    "Approved idea:",
    "Title: Buzun Altındaki Sessiz Radyo",
    "Premise: Bir keşif sondası, buzlu bir uydunun altında doğal açıklamalarla karıştırılabilecek düzenli radyo darbeleri bulur.",
    "Style: Türkçe, sinematik, bilimsel olarak dikkatli.",
  ].join("\n");
}
