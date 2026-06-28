export function renderIdeaEvalPrompt(): string {
  return [
    "IDEAS_JSON",
    "Return exactly three original UykulukSciFi YouTube video ideas in Turkish.",
    "Use careful science framing and avoid generic repeated premise frames.",
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

export const ideaEvalResponseFormat = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          premise: { type: "string" },
          targetDuration: { type: "string" },
          style: { type: "string" },
          estimatedDifficulty: { type: "string" },
          riskLevel: { type: "string" },
          fit: { type: "string" },
        },
        required: [
          "title",
          "premise",
          "targetDuration",
          "style",
          "estimatedDifficulty",
          "riskLevel",
          "fit",
        ],
      },
    },
  },
  required: ["ideas"],
} as const satisfies Record<string, unknown>;
