import type { VideoIdeaLevel } from "../stages/types.js";

type MockIdea = {
  id: string;
  title: string;
  premise: string;
  targetDuration: string;
  style: string;
  estimatedDifficulty: VideoIdeaLevel;
  riskLevel: VideoIdeaLevel;
  fit: string;
};

export function generateMockIdeasText(): string {
  return JSON.stringify({ ideas: mockIdeas() });
}

export function generateInvalidDuplicateIdeasText(): string {
  const repeatedIdea = {
    id: "idea_001",
    title: "Tekrar Eden Gezegen",
    premise:
      "Bir keşif ekibi aynı gezegenden gelen sakin sinyali bilimsel ihtiyatla yeniden dinler.",
    targetDuration: "8-10 dakika",
    style: "sakin sinematik bilimkurgu anlatısı",
    estimatedDifficulty: "low" satisfies VideoIdeaLevel,
    riskLevel: "low" satisfies VideoIdeaLevel,
    fit: "UykulukSciFi kanalının merak, bilimsel ihtiyat ve sakin anlatı tonuna uygun.",
  };
  return JSON.stringify({
    ideas: [
      repeatedIdea,
      {
        ...repeatedIdea,
        id: "idea_002",
        premise: "Aynı görünen bu fikir, operatör açısından farklı bir öneri gibi davranmamalıdır.",
      },
    ],
  });
}

export function generateInvalidRepeatedPremiseFrameIdeasText(): string {
  const sharedPremiseStart =
    "Bir uzay gemisindeki bilim insanları uzaktaki bir dünyanın yüzeyindeki ölçümlerin";
  return JSON.stringify({
    ideas: [
      {
        id: "idea_001",
        title: "Atmosferdeki Yavaş Ölçüm",
        premise: `${sharedPremiseStart} belki de doğal kimya ile açıklanabileceğini düşünür.`,
        targetDuration: "20 dakika",
        style: "sakin sinematik bilimkurgu anlatısı",
        estimatedDifficulty: "medium" satisfies VideoIdeaLevel,
        riskLevel: "low" satisfies VideoIdeaLevel,
        fit: "UykulukSciFi kanalının merak, bilimsel ihtiyat ve görsel anlatı tonuna uygun.",
      },
      {
        id: "idea_002",
        title: "Basınç Altındaki Kayıt",
        premise: `${sharedPremiseStart} henüz bilinmeyen jeolojik süreçlerle ilişkili olabileceğini sorgular.`,
        targetDuration: "20 dakika",
        style: "temkinli kozmik keşif anlatısı",
        estimatedDifficulty: "medium" satisfies VideoIdeaLevel,
        riskLevel: "medium" satisfies VideoIdeaLevel,
        fit: "UykulukSciFi için kanıt iddiası kurmadan güçlü bir bilimkurgu merakı taşır.",
      },
      {
        id: "idea_003",
        title: "Mineral Yankısının İzleri",
        premise: `${sharedPremiseStart} kesin kanıt değildir diyerek tekrar ölçüm planlar.`,
        targetDuration: "20 dakika",
        style: "atmosferik bilimsel ihtiyat",
        estimatedDifficulty: "low" satisfies VideoIdeaLevel,
        riskLevel: "low" satisfies VideoIdeaLevel,
        fit: "Kanalın sakin ve bilimsel ihtiyat taşıyan üretim çizgisine uygun.",
      },
    ],
  });
}

function mockIdeas(): MockIdea[] {
  return [
    {
      id: "idea_001",
      title: "Derin Buzun Altındaki Nabız",
      premise:
        "Buz kabuğunun altındaki okyanusta ölçülen yavaş titreşimler, yaşam kanıtı olmadan da merak uyandıran bir keşfe dönüşür.",
      targetDuration: "8-10 dakika",
      style: "sakin sinematik bilimkurgu anlatısı",
      estimatedDifficulty: "low",
      riskLevel: "low",
      fit: "UykulukSciFi kanalının bilimsel ihtiyat, merak ve görsel atmosfer tonuna uygun.",
    },
    {
      id: "idea_002",
      title: "Titan Arşivindeki Yağmur",
      premise:
        "Metan yağmurlarıyla dolu uzak bir dünyada eski bir sonda, iklim döngülerini yanlış yorumlamadan kayda alır.",
      targetDuration: "9-11 dakika",
      style: "yavaş tempolu kozmik keşif",
      estimatedDifficulty: "medium",
      riskLevel: "low",
      fit: "UykulukSciFi için uzak dünya merakı ile temkinli bilimsel anlatıyı birleştirir.",
    },
    {
      id: "idea_003",
      title: "Mars Tozundaki Eski Sinyal",
      premise:
        "Terk edilmiş bir habitatın kayıtlarında bulunan ritim, önce cihaz hatası olarak incelenir, sonra dikkatli bir öykü kapısı aralar.",
      targetDuration: "8-10 dakika",
      style: "belgesel tadında bilimkurgu gerilimi",
      estimatedDifficulty: "low",
      riskLevel: "medium",
      fit: "Kanalın sakin tonuna uygun şekilde kanıt iddiası kurmadan merak üretir.",
    },
    {
      id: "idea_004",
      title: "Neptün Gölgesinde Yavaş Saat",
      premise:
        "Bir araştırma istasyonu, zaman ölçümlerindeki küçük sapmaları felaket değil, ölçüm sınırı ve olasılık olarak ele alır.",
      targetDuration: "10-12 dakika",
      style: "felsefi ve ölçülü bilimkurgu",
      estimatedDifficulty: "medium",
      riskLevel: "medium",
      fit: "UykulukSciFi evreninde zaman, kuşku ve bilimsel dikkat temasını güçlendirir.",
    },
    {
      id: "idea_005",
      title: "Ay Tozunda Saklı Laboratuvar",
      premise:
        "Ay yüzeyindeki eski bir deney düzeneği, insan hatası ile beklenmedik veri arasındaki ince çizgiyi gösterir.",
      targetDuration: "7-9 dakika",
      style: "minimalist keşif anlatısı",
      estimatedDifficulty: "low",
      riskLevel: "low",
      fit: "Kanal için düşük maliyetli görsellerle güçlü bir bilimkurgu öyküsü kurabilir.",
    },
    {
      id: "idea_006",
      title: "Venüs Bulutlarında Kayıp Ölçüm",
      premise:
        "Kalın atmosferde kaybolan bir balon sondası, yaşam iddiası yerine kimya ve basınç hakkında temkinli sorular bırakır.",
      targetDuration: "9-11 dakika",
      style: "atmosferik bilimsel merak",
      estimatedDifficulty: "medium",
      riskLevel: "medium",
      fit: "UykulukSciFi'nin kesin hükümden kaçınan bilimsel ihtiyat çizgisini destekler.",
    },
    {
      id: "idea_007",
      title: "Kuyruklu Taştaki Kırık Harita",
      premise:
        "Bir kuyruklu taşın yüzeyindeki çatlak desenleri, harita gibi görünse de önce doğal süreçlerle açıklanmaya çalışılır.",
      targetDuration: "8-10 dakika",
      style: "sinematik gizem ve keşif",
      estimatedDifficulty: "medium",
      riskLevel: "low",
      fit: "Merak uyandıran ama abartısız anlatımıyla kanal tonuna uygun bir olasılık sunar.",
    },
    {
      id: "idea_008",
      title: "Satürn Halkasında Sessiz Deney",
      premise:
        "Halka parçacıkları arasına bırakılan küçük bir ölçüm cihazı, evrenin düzenini sakin verilerle düşündürür.",
      targetDuration: "8-10 dakika",
      style: "sakin kozmik bilimkurgu anlatısı",
      estimatedDifficulty: "low",
      riskLevel: "low",
      fit: "UykulukSciFi için görsel ritim, bilimsel merak ve yavaş anlatı dengesini korur.",
    },
  ];
}
