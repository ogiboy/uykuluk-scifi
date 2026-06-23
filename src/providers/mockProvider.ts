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
  if (prompt.includes("Section Expansion Contract")) {
    return generateExpandedMockScriptSection(
      sectionId,
      Number(prompt.match(/Expansion chunk: (\d+)\/\d+/)?.[1] ?? "1"),
    );
  }
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

function generateExpandedMockScriptSection(
  sectionId: string | undefined,
  chunkIndex: number,
): string {
  if (sectionId === "hook") {
    return expandedSectionJson(sectionChunkText("hook", chunkIndex));
  }
  if (sectionId === "context") {
    return expandedSectionJson(sectionChunkText("context", chunkIndex));
  }
  if (sectionId === "development") {
    return expandedSectionJson(sectionChunkText("development", chunkIndex));
  }
  return expandedSectionJson(sectionChunkText("outro", chunkIndex));
}

function sectionChunkText(
  sectionId: "hook" | "context" | "development" | "outro",
  chunkIndex: number,
): string[] {
  const chunks: Record<typeof sectionId, string[][]> = {
    hook: [
      [
        "Anlatıcı: Bazı gezegenler vardır; dışarıdan bakıldığında yalnızca sessiz bir buz kabuğu gibi görünür. Peki ya bu sessizlik, dinlemeyi bilmediğimiz kadar yavaş atan bir okyanus kalbiyse? Görsel: Kamera, uzak bir yıldızın soluk ışığında mavi çatlakların üzerinde süzülürken buzun altındaki gölgeler neredeyse nefes alır.",
        "Anlatıcı: Bu açılış kesin cevap değil, dikkatli bir soru ister; çünkü merak, en güçlü hâline abartılmadığında ulaşır.",
      ],
      [
        "Görsel: Yalnız bir sonda yüzeydeki karanlık çizgilerin arasından veri toplar ve ekranda düşük frekanslı yankılar belirir. Anlatıcı: Her yankı bir mesaj olmak zorunda değildir; bazen yalnızca buzun, basıncın ve gelgitin uzun zamana yayılmış hareketidir.",
        "Anlatıcı: Yine de bu olasılık, hikâyenin kapısını aralar ve izleyiciyi yavaş, dikkatli, sinematik bir keşfe davet eder.",
      ],
      [
        "Anlatıcı: Bölümün ilk dakikası bu yüzden telaş etmez; görüntü önce boşluğu, sonra çatlağı, sonra da ölçüm cihazındaki küçük titreşimi gösterir. Görsel: Müzik neredeyse fısıltı düzeyindedir ve yıldız ışığı buzun üzerinde ince bir çizgi olarak kalır.",
        "Anlatıcı: Soru basittir ama cevabı aceleye gelmez: Sessizlik gerçekten boşluk mudur, yoksa henüz çeviremediğimiz bir ritim mi saklar?",
      ],
    ],
    context: [
      [
        "Anlatıcı: Europa ve Enceladus gibi buzlu dünyalar, yaşam ihtimalini konuşurken yalnızca yüzeye bakmanın yetmediğini hatırlatır. Bilim burada kesin bir kanıttan değil; sıvı su, gelgit ısınması, mineral alışverişi ve uzun zaman ölçeklerinin aynı sahnede buluşma olasılığından söz eder.",
        "Görsel: Buz kabuğunun kesit animasyonu, üstte donmuş yüzeyi, altta karanlık okyanusu gösterir.",
      ],
      [
        "Anlatıcı: Bu ihtimalin büyüleyici tarafı, bilimkurguya kapı açmasıdır; ama o kapıdan geçerken varsayımları kanıt gibi sunmamak gerekir. Bir ritim mesaj olmayabilir, bir ışık biyoloji olmayabilir, bir düzen yalnızca jeolojinin sabırlı imzası olabilir.",
        "Görsel: Ekranda üç sakin seçenek belirir: cihaz hatası, jeolojik süreç ve bilinmeyen kimya.",
      ],
      [
        "Anlatıcı: Bu yüzden anlatı her yeni veriyi önce sınırlarıyla birlikte taşır. İzleyiciye yalnızca neyin mümkün olabileceği değil, neyin henüz bilinmediği de söylenir. Görsel: Kısa bilgi kartları su, basınç, tuzluluk ve gelgit etkisini sade cümlelerle açıklar.",
        "Anlatıcı: Bilimsel ihtiyat, hayal gücünü azaltmaz; onu daha güvenilir bir zemine indirir.",
      ],
    ],
    development: [
      [
        "Anlatıcı: Sonda ilk yankıyı aldığında kontrol odasında kimse bunu keşif diye adlandırmaya cesaret edemez. İyi bilim, heyecanın en yüksek olduğu anda bile önce yanılma ihtimalini düşünür. Görsel: Karanlık bir odada veri çizgileri dalgalanır; operatörler sessizce birbirine bakar.",
        "Anlatıcı: Kamera sonra yeniden buz yüzeyindeki tek ışık noktasına döner.",
      ],
      [
        "Anlatıcı: İkinci yankı geldiğinde ritim biraz daha belirginleşir; üçüncüde ise buzun altında hareket eden bir akıntı modeliyle çakışır. Belki yalnızca gelgit kuvvetleri, belki tuzlu suyun kayaya sürtünmesi, belki de henüz adını koyamadığımız bir kimyasal döngü vardır.",
        "Görsel: Mineral bulutları ağır çekimde yıldız tozu gibi suya karışır.",
      ],
      [
        "Anlatıcı: Hikâye burada büyük bir açıklamaya koşmaz; bunun yerine ölçümün tekrar edilmesini, hatanın ayıklanmasını ve sessizliğin yeniden dinlenmesini bekler. Görsel: Sonda, buzun altında bir an durur; ışığı mineral parçacıklarının arasında yavaşça dağılır.",
        "Anlatıcı: Gerilim, kesinlikten değil, dikkatli bekleyişten doğar.",
      ],
    ],
    outro: [
      [
        "Anlatıcı: Bu hikâyenin sonunda elimizde kesin bir cevap yok; ama UykulukSciFi'nin sevdiği yer tam da burasıdır. Evren bazen bağırarak değil, neredeyse duyulmayacak kadar sakin bir ritimle yaklaşır. Görsel: Sonda, buz yüzeyinde küçük bir ışık olarak kalır; üstünde yıldızlar, altında karanlık okyanus uzanır.",
      ],
      [
        "Anlatıcı: Belki orada canlı yoktur, belki yalnızca su, basınç, mineral ve zaman vardır. Yine de doğru soruyu dikkatle sormak, bilinmeyeni sahiplenmeden hayal etmek ve olasılıkları abartmadan takip etmek değerlidir. Görsel: Veri çizgileri yavaşça söner, ekranda yalnızca ölçüm zamanı kalır.",
      ],
      [
        "Anlatıcı: Eğer bu sessiz yolculuk hoşunuza gittiyse, UykulukSciFi'de bir sonraki uzak dünyanın kıyısında yeniden buluşalım. O zamana kadar kesin cevaplardan çok iyi soruların peşinde kalalım. Görsel: Kamera buz yüzeyinden uzaklaşır, mavi gezegen yıldızların arasında küçük ve sakin bir noktaya dönüşür.",
      ],
    ],
  };
  return chunks[sectionId][Math.max(0, Math.min(chunkIndex - 1, 2))];
}

function expandedSectionJson(paragraphs: string[]): string {
  return sectionJson([
    ...paragraphs,
    "Anlatıcı: Tempo burada bilinçli olarak yavaş kalır; her bilgi kırıntısı önce görüntüyle, sonra kısa bir açıklamayla desteklenir. Görsel: Ekranda küçük notlar belirir, ana iddia sakinleşir ve izleyiciye acele etmeden düşünmek için alan açılır. Bu ritim, hem bilimsel ihtiyatı hem de sinematik merakı aynı çizgide tutar; sahne nefes alır, veri anlaşılır kalır ve anlatı sakinliğini korur.",
  ]);
}

function sectionJson(paragraphs: string[]): string {
  return JSON.stringify({ text: paragraphs.join("\n\n") });
}
