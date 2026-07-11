import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
  approximateTokens,
} from "./llmProvider.js";
import {
  generateHistoryAwareMockIdeasText,
  generateInvalidDuplicateIdeasText,
  generateInvalidRepeatedPremiseFrameIdeasText,
} from "./mockIdeasText.js";
import { generateMockScriptContinuation, generateMockScriptSection } from "./mockScriptText.js";

const invalidInitialIdeaModels = new Set([
  "mock-invalid-ideas-then-repair",
  "mock-invalid-ideas-always",
  "mock-invalid-ideas-two-repairs",
]);

export class MockProvider implements LlmProvider {
  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const started = Date.now();
    const text = generateMockText(input.prompt, input.model);
    return {
      text,
      provider: "mock",
      model: input.model ?? "mock-deterministic",
      inputTokensApprox: approximateTokens(`${input.system ?? ""}\n${input.prompt}`),
      outputTokensApprox: approximateTokens(text),
      durationMs: Math.max(1, Date.now() - started),
    };
  }
}

function generateMockText(prompt: string, model = ""): string {
  if (prompt.includes("IDEA_REPAIR_JSON")) {
    return generateMockIdeaRepairText(prompt, model);
  }
  if (prompt.includes("IDEAS_JSON")) {
    return generateMockIdeaText(model, prompt);
  }
  if (prompt.includes("SCRIPT_CONTINUATION_JSON")) {
    if (model === "mock-invalid-continuation-json") {
      return '{"text":"Anlatıcı: yarım"';
    }
    return generateMockScriptContinuation(prompt, model);
  }
  if (prompt.includes("SCRIPT_SECTION_JSON")) {
    if (model === "mock-invalid-script-json") {
      return "Mock provider returned non-JSON script section text.";
    }
    if (model === "mock-script-quality-artifacts") {
      return JSON.stringify({
        text: "Anlatıcı: Bu durum, Kuşak Gemisi’nin kor kor kor kor kor kor kor kor kor kor yapısını bozuyor. Görsel: Bahçe ekranında renk geçişi görünür.”} id=hook, section_id=idea_003.",
      });
    }
    return generateMockScriptSection(prompt, model);
  }
  if (prompt.includes("SCRIPT_MARKDOWN")) {
    return [
      "# Uyuyan Bir Gezegenin Altindaki Okyanus",
      "",
      "Bazi gezegenler vardir; disaridan bakildiginda sadece sessizlik gibi gorunur. Kalin bir buz kabugu, uzak bir yildizin soluk isigini geri yansitir ve bize orada hicbir sey olmadigini fisildar.",
      "",
      "Ama bilim bize sunu ogretir: sessizlik her zaman bosluk anlamina gelmez. Europa ve Enceladus gibi uydular, buzun altinda sivi su okyanuslari barindirabilir. Bu kesin bir yasam kaniti degildir; sadece evrenin yasama elverisli kosullari nerelerde saklayabilecegine dair guclu bir ipucudur.",
      "",
      "Bu hikayede yalniz bir sonda, buzun altina gonderdigi dusuk frekansli yankilarda duzenli bir ritim fark eder. Ritim bir mesaj olmayabilir. Jeolojik bir surec, gelgit etkisi ya da cihaz hatasi olabilir. Fakat her olasilik, gezegenin sanildigindan daha canli bir ic dunyaya sahip oldugunu gosterir.",
      "",
      "Goruntu once karanliktir: catlak buz, mavi yansimalar ve uzaktan gelen metalik bir titreşim. Sonra kamera, okyanusun derinliklerinde suyun tasidigi mineralleri, sicaklik farklarini ve beklenmedik akintilari takip eder.",
      "",
      "Belki orada canli yoktur. Belki sadece kimya, basinç ve zaman vardir. Ama bazen bilimkurgunun en guzel yani, kesin cevap vermek degil; dogru soruyu sakin bir sesle sormaktir.",
      "",
      "Eger bu yolculuk hosunuza gittiyse, UykulukSciFi'de bir sonraki sessiz gezegende yeniden bulusalim.",
    ].join("\n");
  }
  if (prompt.includes("PRODUCTION_PACKAGE_JSON")) {
    return JSON.stringify({
      popupCards: [
        "Not: Buz alti okyanus fikri Europa ve Enceladus gozlemlerinden ilham alir.",
        "Bilimsel ihtiyat: Ritim veya isik deseni yasam kaniti olarak yorumlanmamalidir.",
      ],
      lowerThirds: ["Sonda Telemetrisi", "Buz Alti Okyanus", "Gelgit Isinmasi"],
      youtube: {
        title: "Uyuyan Bir Gezegenin Altindaki Okyanus | UykulukSciFi",
        description:
          "Buz kabugunun altinda sakli olabilecek okyanuslara dair sinematik ve bilimsel ihtiyat tasiyan bir bilimkurgu anlatimi.",
        tags: ["uykulukscifi", "bilimkurgu", "europa", "uzay", "turkce anlatim"],
      },
    });
  }
  return "Mock provider output.";
}

function generateMockIdeaRepairText(prompt: string, model: string): string {
  if (model === "mock-invalid-ideas-two-repairs") {
    return prompt.includes("Ideas reuse a repeated premise frame")
      ? generateHistoryAwareMockIdeasText(prompt, model)
      : generateInvalidRepeatedPremiseFrameIdeasText();
  }
  if (model === "mock-invalid-ideas-always") {
    return generateInvalidDuplicateIdeasText();
  }
  return generateHistoryAwareMockIdeasText(prompt, model);
}

function generateMockIdeaText(model: string, prompt = ""): string {
  return invalidInitialIdeaModels.has(model)
    ? generateInvalidDuplicateIdeasText()
    : generateHistoryAwareMockIdeasText(prompt, model);
}
