const ideaProperties = {
  id: { type: ["string", "number"] },
  title: { type: "string" },
  premise: { type: "string" },
  targetDuration: { type: ["string", "number"] },
  style: { type: "string" },
  estimatedDifficulty: { type: "string" },
  riskLevel: { type: "string" },
  fit: { type: "string" },
} as const;

export const ideasResponseFormat = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      minItems: 5,
      maxItems: 10,
      items: {
        type: "object",
        properties: ideaProperties,
        required: Object.keys(ideaProperties),
      },
    },
  },
  required: ["ideas"],
} as const satisfies Record<string, unknown>;

export const productionPackageResponseFormat = {
  type: "object",
  properties: {
    popupCards: { type: "array", items: { type: "string" } },
    lowerThirds: { type: "array", items: { type: "string" } },
    youtube: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["title", "description", "tags"],
    },
  },
  required: ["popupCards", "lowerThirds", "youtube"],
} as const satisfies Record<string, unknown>;
