export function generateMockScriptSection(prompt: string, model: string): string {
  const sectionId = /Section id: (\w+)/.exec(prompt)?.[1];
  if (prompt.includes("Section Expansion Contract")) {
    const expansionChunk = /Expansion chunk: (\d+)\/\d+/.exec(prompt)?.[1] ?? "1";
    if (model === "mock-repeated-script-expansion-then-repair" && isFirstHookExpansion(prompt)) {
      return repeatedExpansionLoopJson();
    }
    if (model === "mock-repeated-script-expansion") {
      return repeatedExpansionLoopJson();
    }
    if (model === "mock-unaccented-script-labels") {
      return unaccentedLabelExpansionJson(sectionId, Number(expansionChunk));
    }
    if (model === "mock-malformed-script-labels") {
      return malformedLabelExpansionJson();
    }
    if (
      model === "mock-short-script" ||
      model === "mock-invalid-continuation-json" ||
      model === "mock-repeated-continuation-then-repair"
    ) {
      return sectionJson([shortExpansionText(sectionId, Number(expansionChunk))]);
    }
    return generateExpandedMockScriptSection(sectionId, Number(expansionChunk));
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

function repeatedExpansionLoopJson(): string {
  const repeated =
    "Anlatıcı: Bu kaybolma, bilim insanlarının yeni teoriler geliştirmesini zorunlu kılıyor.";
  return sectionJson([repeated, repeated, repeated]);
}

function unaccentedLabelExpansionJson(sectionId: string | undefined, chunkIndex: number): string {
  const section = (sectionId ?? "outro") as MockScriptSectionId;
  return sectionJson(
    sectionChunkText(section, chunkIndex).map((paragraph) =>
      paragraph
        .replaceAll("Anlatıcı:", "Anlatici:")
        .replaceAll("Görsel:", "Gorsel:")
        .replaceAll("Anlatıcı", "Anlatyıcı"),
    ),
  );
}

function malformedLabelExpansionJson(): string {
  return sectionJson([
    "Anlatıcı: Ekip bu işareti kesin kanıt gibi sunmadan önce sakin bir ölçüm planı kurar.",
    "Görüntü: Panelde doğal açıklama, cihaz hatası ve yeni gözlem kartları yan yana açılır.",
  ]);
}

type MockScriptSectionId = "hook" | "context" | "development" | "outro";

export function generateMockScriptContinuation(prompt: string): string;
export function generateMockScriptContinuation(prompt: string, model: string): string;
export function generateMockScriptContinuation(prompt: string, model = ""): string {
  const chunkIndex = /Continuation chunk: (\d+)\/\d+/.exec(prompt)?.[1] ?? "1";
  if (
    model === "mock-repeated-continuation-then-repair" &&
    chunkIndex === "1" &&
    !prompt.includes("SCRIPT_CONTENT_RETRY")
  ) {
    return repeatedExpansionLoopJson();
  }
  return sectionJson(chunkIndex === "1" ? continuationChunkOne() : continuationChunkTwo());
}

function isFirstHookExpansion(prompt: string): boolean {
  return (
    /Section id: hook/u.test(prompt) &&
    /Expansion chunk: 1\/\d+/u.test(prompt) &&
    !prompt.includes("SCRIPT_CONTENT_RETRY")
  );
}

function generateExpandedMockScriptSection(
  sectionId: string | undefined,
  chunkIndex: number,
): string {
  if (sectionId === "hook") {
    return expandedSectionJson(sectionChunkText("hook", chunkIndex), "hook", chunkIndex);
  }
  if (sectionId === "context") {
    return expandedSectionJson(sectionChunkText("context", chunkIndex), "context", chunkIndex);
  }
  if (sectionId === "development") {
    return expandedSectionJson(
      sectionChunkText("development", chunkIndex),
      "development",
      chunkIndex,
    );
  }
  return expandedSectionJson(sectionChunkText("outro", chunkIndex), "outro", chunkIndex);
}

function shortExpansionText(sectionId: string | undefined, chunkIndex: number): string {
  const sectionLabel = sectionId ?? "bölüm";
  const chunkName = ["birinci", "ikinci", "üçüncü"][chunkIndex - 1] ?? "ek";
  return [
    `Anlatıcı: ${sectionLabel} bölümünün ${chunkName} kısa parçası sahneyi sakin tutar, bilimsel ihtiyatı korur ve görsel ritmi ölçülü biçimde geliştirir.`,
    `Görsel: ${sectionLabel} için ${chunkName} veri çizgisi yavaşça akar; buzun altındaki karanlık tek bir büyük iddia gibi değil, dikkatle incelenmesi gereken bir olasılık alanı gibi görünür.`,
    `Anlatıcı: Bu ${chunkName} parça ${sectionLabel} akışında acele etmeden ilerler; ölçüm, kuşku ve atmosfer aynı sakin çizgide birleşir.`,
  ].join(" ");
}

function sectionChunkText(sectionId: MockScriptSectionId, chunkIndex: number): string[] {
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

function expandedSectionJson(
  paragraphs: string[],
  sectionId: MockScriptSectionId,
  chunkIndex: number,
): string {
  return sectionJson([...paragraphs, closingTexture(sectionId, chunkIndex)]);
}

function closingTexture(sectionId: MockScriptSectionId, chunkIndex: number): string {
  const sectionName = {
    context: "bağlam",
    development: "gelişme",
    hook: "açılış",
    outro: "kapanış",
  }[sectionId];
  const chunkName = ["birinci", "ikinci", "üçüncü"][chunkIndex - 1] ?? "ek";
  return [
    `Anlatıcı: ${sectionName} akışının ${chunkName} genişlemesi bilinçli olarak yavaş kalır; bilgi kırıntısı önce görüntüyle, sonra kısa bir açıklamayla desteklenir.`,
    `Görsel: ${sectionName} için ${chunkName} küçük not ekranda belirir, ana iddia sakinleşir ve izleyiciye acele etmeden düşünmek için alan açılır.`,
    `Anlatıcı: Bu ritim, ${sectionName} bölümünde ${chunkName} kez bilimsel ihtiyatı ve sinematik merakı aynı çizgide tutar; sahne nefes alır ve anlatı sakinliğini korur.`,
  ].join(" ");
}

function continuationChunkOne(): string[] {
  return [
    "Anlatıcı: Sonda aynı yankıyı ikinci kez dinlediğinde, hikâye daha geniş bir nefes alır. Önce cihaz hatası olasılığı masaya yatırılır; kablo bağlantıları, zaman damgaları, sıcaklık farkları ve buz yüzeyindeki titreşimler tek tek karşılaştırılır. Görsel: Kontrol panelinde üç ayrı grafik yavaşça üst üste biner; hiçbir çizgi tek başına büyük bir iddia taşımaz, ama birlikte bakıldığında dikkatli bir desen önerir. Bu bölümde merak, aceleci bir keşif anı gibi değil, sabırla büyüyen bir soru gibi ilerler.",
    "Anlatıcı: Buzun altında hayal edilen okyanus, yalnızca dramatik bir dekor değildir; basınç, tuzluluk, mineral akışı ve gelgit enerjisi gibi unsurların bir araya geldiği karmaşık bir ortamdır. Bilimsel ihtiyat burada anlatının merkezinde kalır: düzenli görünen her işaret biyolojik değildir, her ışık yaşam değildir, her ritim mesaj değildir. Görsel: Mavi karanlığın içinde küçük mineral parçacıkları ağır çekimde dönerken, ekranda kısa notlar belirir ve her olasılık kendi sınırıyla birlikte anılır.",
    "Anlatıcı: Kontrol ekibi bu veriyi tek bir dramatik sonuca bağlamak yerine, ölçümün çevresindeki koşulları genişletir. Yüzey sıcaklığı, buz kalınlığı, yankının geliş açısı ve sondanın kendi titreşimi aynı tabloda yeniden okunur. Görsel: Ekran ikiye bölünür; bir tarafta ham veri, diğer tarafta olası açıklamalar sakin kartlar halinde akar. İzleyici burada cevaptan çok yöntemi görür; çünkü iyi bir UykulukSciFi anlatısı, bilinmeyeni büyütürken güvenilir düşünme biçimini de görünür kılar.",
    "Anlatıcı: Bu ek derinleşme sahnenin temposunu yavaşlatır ama gerilimi azaltmaz. Tam tersine, her kontrol adımı okyanusun karanlığını daha anlamlı yapar; çünkü yanlış ihtimalleri ayıklamak, geriye kalan soruyu daha berrak hale getirir. Görsel: Sonda buzun altındaki sessiz boşlukta ilerlerken, ışığı yalnızca birkaç metreyi aydınlatır. Karanlık mutlak bir tehdit gibi değil, sabır isteyen bir araştırma alanı gibi sunulur.",
  ];
}

function continuationChunkTwo(): string[] {
  return [
    "Anlatıcı: Üçüncü ölçümde sonda, yankının yalnızca zamana değil, buz kabuğunun çatlak haritasına da bağlı olabileceğini fark eder. Bu, kesin bir cevap vermez; ama sahnenin bilimkurgu tarafını güçlendiren daha iyi bir gerilim kurar. Görsel: Kamera çatlakların arasından aşağı iner, sonra okyanusun karanlık yüzeyinde neredeyse görünmeyen bir akıntıyı takip eder. Verinin kendisi küçük kalır, fakat sorunun ölçeği büyür: Bir dünyanın iç hareketi, dışarıdan bakıldığında nasıl sessizlik gibi görünebilir?",
    "Anlatıcı: Kapanışa yaklaşmadan önce anlatı bir kez daha temkinli davranır. Eğer bu ritim jeolojikse, yine de gezegenin sanıldığından daha etkin olduğunu gösterir; eğer kimyasalsa, buz altı okyanusun beklenmedik döngüler taşıyabileceğini düşündürür; eğer cihaz kaynaklıysa, iyi bilimin neden tekrar ve kontrol istediğini hatırlatır. Görsel: Sonda ışığını kısar, veri çizgileri sadeleşir ve müzik neredeyse duyulmayacak kadar alçalır. Böylece final, abartılı bir keşif yerine, izleyicinin zihninde sakin ama güçlü bir olasılık bırakır.",
    "Anlatıcı: Bu olasılıkların her biri farklı bir görsel ritim doğurur. Jeolojik açıklamada buz kabuğu yavaşça esner; kimyasal açıklamada mineral bulutları suyun içinde puslu bir harita oluşturur; cihaz açıklamasında ise kontrol odası sessizleşir ve ekip tekrar ölçüm ister. Görsel: Üç kısa sahne arka arkaya gelir, fakat hiçbiri tek başına nihai cevap gibi sunulmaz. Böylece izleyici, bilimsel belirsizliğin hikâyeyi zayıflatmadığını, aksine daha dürüst ve daha merak uyandırıcı yaptığını hisseder.",
    "Anlatıcı: Final köprüsü bu nedenle yumuşak kalır. Sonda karanlıkta ilerlerken, anlatı bize yalnızca uzak bir okyanusu değil, bilinmeyene yaklaşma biçimimizi de düşündürür. Bazen en değerli keşif, bir şeyi bulduğumuzu ilan etmek değil, daha iyi bir soru sormayı öğrenmektir. Görsel: Veri akışı yavaşça kaybolur, buz yüzeyi uzaktan yeniden görünür ve gezegenin sessizliği artık boşluk değil, dikkatle dinlenmesi gereken bir davet gibi durur.",
  ];
}

function sectionJson(paragraphs: string[]): string {
  return JSON.stringify({ text: paragraphs.join("\n\n") });
}
