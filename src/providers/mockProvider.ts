import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
  approximateTokens,
} from "./llmProvider.js";

export class MockProvider implements LlmProvider {
  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const started = Date.now();
    const text = generateMockText(input.prompt);
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

function generateMockText(prompt: string): string {
  if (prompt.includes("IDEAS_JSON")) {
    return JSON.stringify({
      ideas: [
        {
          id: "idea_001",
          title: "Uyuyan Bir Gezegenin Altindaki Okyanus",
          premise:
            "Buz kabugunun altinda yavas nefes alan bir okyanus ve onu dinleyen yalniz bir sonda.",
          targetDuration: "8-10 dakika",
          style: "sinematik bilimkurgu anlatimi",
          estimatedDifficulty: "low",
          riskLevel: "low",
          fit: "UykulukSciFi'nin sakin, merak uyandiran ve bilimsel ihtiyat tasiyan tonuna uygun.",
        },
        {
          id: "idea_002",
          title: "Karanlik Maddenin Son Postacisi",
          premise:
            "Galaksiler arasi boslukta sinyal tasiyan bir yapay zeka, anlamlandiramadigi bir harita bulur.",
          targetDuration: "9-11 dakika",
          style: "melankolik uzay operasi",
          estimatedDifficulty: "medium",
          riskLevel: "medium",
          fit: "Kozmik olcekli fikirleri kisilestiren, dusundurucu kanal kimligine yakisir.",
        },
        {
          id: "idea_003",
          title: "Mars'ta Unutulan Ses Kaydi",
          premise:
            "Terk edilmis bir habitatta bulunan kayitlar, gezegenin gecmis iklimine dair ipuclari verir.",
          targetDuration: "7-9 dakika",
          style: "belgesel tadinda gerilim",
          estimatedDifficulty: "low",
          riskLevel: "low",
          fit: "Bilimsel gerceklik ile yavas tempolu hikaye anlatimini birlestirir.",
        },
        {
          id: "idea_004",
          title: "Zamanin Disinda Donen Istasyon",
          premise: "Bir istasyon, her turda evrenin farkli bir yasindan veri toplamaya baslar.",
          targetDuration: "10-12 dakika",
          style: "felsefi hard sci-fi",
          estimatedDifficulty: "medium",
          riskLevel: "medium",
          fit: "Spekulatif ama temkinli bilim diliyle anlatilabilecek yuksek konseptli bir konu.",
        },
        {
          id: "idea_005",
          title: "Europa'nin Sessiz Isiklari",
          premise:
            "Bir kesif ekibi, buz altinda biyolojik olmak zorunda olmayan ritmik isik desenleri gozlemler.",
          targetDuration: "8-10 dakika",
          style: "atmosferik kesif",
          estimatedDifficulty: "medium",
          riskLevel: "low",
          fit: "Kesin hukum vermeden olasiliklari tartisan merak odakli anlatima uygundur.",
        },
      ],
    });
  }
  if (prompt.includes("SCRIPT_SECTION_JSON")) {
    return generateMockScriptSection(prompt);
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

function generateMockScriptSection(prompt: string): string {
  const sectionId = prompt.match(/Section id: (\w+)/)?.[1];
  if (sectionId === "hook") {
    return sectionJson([
      "Anlatıcı: Bazı gezegenler vardır; dışarıdan bakıldığında sadece sessizlik gibi görünür.",
      "Görsel: Kalın buz kabuğu, uzak bir yıldızın soluk ışığını geri yansıtır.",
      "Bu açılışta soru basittir: Sessizlik gerçekten boşluk mudur, yoksa dinlemeyi bilmediğimiz bir ritim mi saklar?",
    ]);
  }
  if (sectionId === "context") {
    return sectionJson([
      "Anlatıcı: Bilim bize kesin hüküm değil, ölçülü olasılıklar verir.",
      "Europa ve Enceladus gibi buzlu dünyalar, suyun ve gelgit ısınmasının beklenmedik yerlerde saklanabileceğini düşündürür.",
      "Bu, yaşam kanıtı değildir; yalnızca doğru soruyu daha dikkatli sormak için bir nedendir.",
    ]);
  }
  if (sectionId === "development") {
    return sectionJson([
      "Anlatıcı: Yalnız bir sonda, buzun altına gönderdiği düşük frekanslı yankılarda düzenli bir titreşim fark eder.",
      "Görsel: Kamera çatlak buz çizgilerinden mavi karanlığa inerken, mineral bulutları ağır çekimde dağılır.",
      "Ritim bir mesaj olmayabilir; jeolojik bir süreç, gelgit etkisi ya da cihaz hatası olabilir.",
    ]);
  }
  return sectionJson([
    "Anlatıcı: Belki orada canlı yoktur; belki yalnızca kimya, basınç ve zaman vardır.",
    "Ama bazen bilimkurgunun en güzel yanı kesin cevap vermek değil, doğru soruyu sakin bir sesle korumaktır.",
    "Bu yolculuk hoşunuza gittiyse, UykulukSciFi'de bir sonraki sessiz gezegende yeniden buluşalım.",
  ]);
}

function sectionJson(paragraphs: string[]): string {
  return JSON.stringify({ text: paragraphs.join("\n\n") });
}
