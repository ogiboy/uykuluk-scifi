import { z } from "zod";
import { SafeExitError } from "../../core/errors.js";
import { canonicalJsonDigest } from "../../utils/canonicalJsonDigest.js";

export const promptProfileIdSchema = z.enum([
  "sci-fi",
  "science-space",
  "technology",
  "history-mystery",
  "custom-brief",
]);

export const promptProfileSchema = z.object({
  id: promptProfileIdSchema,
  labels: z.strictObject({ tr: z.string().min(1).max(80), en: z.string().min(1).max(80) }),
  genre: z.string().trim().min(1).max(120),
  generationPrompt: z
    .string()
    .min(1)
    .max(4_000)
    .refine(isControlSafeText, {
      message: "Prompt profile text contains unsafe control characters.",
    }),
  requiresOperatorBrief: z.boolean(),
});

export type PromptProfile = z.infer<typeof promptProfileSchema>;
export type PromptProfileId = z.infer<typeof promptProfileIdSchema>;

export const promptProfiles: readonly PromptProfile[] = [
  profile(
    "sci-fi",
    { tr: "Bilim Kurgu", en: "Science Fiction" },
    "science-fiction",
    "Bilimsel tutarlılığı koruyan, sinematik fakat anlaşılır Türkçe bilimkurgu fikirleri üret. Spekülasyonu doğrulanmış bilimden açıkça ayır.",
  ),
  profile(
    "science-space",
    { tr: "Bilim ve Uzay", en: "Science and Space" },
    "science-space",
    "Bilim ve uzay odağında fikirler üret. Gözlem, kanıt ve belirsizliği ayır; doğrulanamayan iddiaları kesin gerçek gibi sunma.",
  ),
  profile(
    "technology",
    { tr: "Teknoloji", en: "Technology" },
    "technology",
    "Teknoloji odağında fikirler üret. Mekanizmayı, sınırları ve gerçek dünya etkisini dengeli, erişilebilir Türkçe ile açıkla.",
  ),
  profile(
    "history-mystery",
    { tr: "Tarih ve Gizem", en: "History and Mystery" },
    "history-mystery",
    "Tarih ve gizem odağında fikirler üret. Kaynaklı gerçekleri spekülasyondan ayır; gizemi uydurma kesinlikle çözme.",
  ),
  profile(
    "custom-brief",
    { tr: "Kendi Fikrini Yaz", en: "Write Your Own Idea" },
    "custom",
    "Operatörün verdiği özel konu, kapsam, ton ve doğruluk sınırlarına bağlı fikirler üret.",
    true,
  ),
];

export function selectPromptProfile(
  id: PromptProfileId,
  profiles: readonly PromptProfile[] = promptProfiles,
): PromptProfile {
  const profile = profiles.find((candidate) => candidate.id === id);
  if (!profile) throw new SafeExitError(`Prompt profile not found: ${id}`);
  return profile;
}

export function promptProfileDigest(profile: PromptProfile): string {
  return canonicalJsonDigest(promptProfileSchema.parse(profile), {
    nonFiniteNumber: "Prompt profile cannot contain a non-finite number.",
    unsupportedValue: "Prompt profile contains an unsupported value.",
  });
}

function profile(
  id: PromptProfileId,
  labels: PromptProfile["labels"],
  genre: string,
  generationPrompt: string,
  requiresOperatorBrief = false,
): PromptProfile {
  return promptProfileSchema.parse({ id, labels, genre, generationPrompt, requiresOperatorBrief });
}

function isControlSafeText(value: string): boolean {
  return [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 32 || character === "\n" || character === "\r" || character === "\t";
  });
}
