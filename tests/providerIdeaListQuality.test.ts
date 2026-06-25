import { describe, expect, it } from "vitest";
import { parseIdeasProviderPayload } from "../src/stages/providerPayloads";

const validIdea = {
  id: "idea_001",
  title: "Sessiz Gezegen",
  premise: "Buz altinda sakli bir okyanusun temkinli kesfi.",
  targetDuration: "20 dakika",
  style: "sinematik bilimkurgu",
  estimatedDifficulty: "medium",
  riskLevel: "low",
  fit: "UykulukSciFi tonuna uygun.",
};

describe("provider idea list quality", () => {
  it("rejects duplicate local-model ideas instead of offering a weak review list", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Sessiz Gezegen",
            premise: "Aynı başlıkla farklı görünen ama operatör için tekrar eden fikir.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Karanlık Okyanus",
            premise: "Buz altinda sakli bir okyanusun temkinli kesfi.",
          },
        ]),
      ),
    ).toThrow(/distinct/i);
  });

  it("rejects repeated generic title motifs across the idea list", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Yıldızın İç Yüzü",
            premise: "Yıldızın içinde saklanan verinin kesin kanıt olmadığını varsayalım.",
            fit: "Yıldız motifi üzerinden temkinli bir bilimsel gizem kurar.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Yıldızlararası Arşiv",
            premise: "Uzaktaki bir arşivin yıldız ışığıyla bozulmuş olması mümkün olabilir.",
            fit: "Arşiv fikriyle sakin keşif tonunu destekler.",
          },
        ]),
      ),
    ).toThrow(/title motif/i);
  });

  it("rejects repeated fit sentence frames across otherwise distinct ideas", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            fit: "Buzaltı haritası üzerine bilimsel bir yaklaşımla sakin bir keşif vadeder.",
          },
          {
            ...validIdea,
            id: "idea_002",
            title: "Lav Belleği",
            premise: "Lav katmanlarında ölçülen düzenin kesin kanıt olmadığını varsayalım.",
            fit: "Lav belleği üzerine bilimsel bir yaklaşımla görsel bir araştırma vadeder.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Nötrino Gecikmesi",
            premise: "Geciken sinyalin doğal gürültü olabileceği dikkatle incelenir.",
            fit: "Nötrino gecikmesi üzerine bilimsel bir yaklaşımla temkinli bir merak vadeder.",
          },
        ]),
      ),
    ).toThrow(/Fit explanations reuse a repeated sentence frame/);
  });

  it("rejects repeated generic fit boilerplate across repaired local-model ideas", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            fit: "Buzaltı haritası, buzaltı okyanuslarının bilimsel sorularını sakin görsellere bağlar.",
          },
          {
            ...validIdea,
            id: "idea_002",
            title: "Lav Belleği",
            premise: "Lav katmanlarında ölçülen düzenin kesin kanıt olmadığını varsayalım.",
            fit: "Lav belleği, ötegezegen jeolojisinin bilimsel sorularını temkinli biçimde işler.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Nötrino Gecikmesi",
            premise: "Geciken sinyalin doğal gürültü olabileceği dikkatle incelenir.",
            fit: "Nötrino gecikmesi, zaman gecikmeli sinyallerin bilimsel sorularını görünür kılar.",
          },
        ]),
      ),
    ).toThrow(/generic "bilimsel soruları" boilerplate/i);
  });

  it("rejects repeated premise frames across otherwise non-identical local-model ideas", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          validIdea,
          {
            ...validIdea,
            id: "idea_002",
            title: "Atmosferin Dalgaları",
            premise:
              "Bir uzay gemisindeki bilim insanları uzaktaki bir gezegenin atmosferindeki dalgaların belki de yaşamın izlerini taşıdığını fark ederler.",
            fit: "Atmosfer ölçümlerini ihtiyatlı bir keşif sorusuna dönüştürür.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Sesin Dalgaları",
            premise:
              "Bir uzay gemisindeki bilim insanları uzaktaki bir gezegenin yüzeyindeki seslerin belki de yaşamın izlerini taşıdığını fark ederler.",
            fit: "Ses verilerini sakin ve görsel bir araştırma hattına taşır.",
          },
          {
            ...validIdea,
            id: "idea_004",
            title: "Yüzeyin Dalgaları",
            premise:
              "Bir uzay gemisindeki bilim insanları uzaktaki bir gezegenin okyanusundaki ritimlerin belki de yaşamın izlerini taşıdığını fark ederler.",
            fit: "Okyanus ritimlerini kesin hüküm vermeden bilimkurgu merakına bağlar.",
          },
        ]),
      ),
    ).toThrow(/repeated premise frame/i);
  });

  it("rejects repeated uncertainty openers across local-model idea premises", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            premise:
              "Ay yüzeyindeki paslı arşiv önce doğal süreçlerle açıklanır. Belki bu arşiv yalnızca eski sensör hatalarının izidir.",
          },
          {
            ...validIdea,
            id: "idea_002",
            title: "Lav Belleği",
            premise:
              "Genç jeolog lav akışındaki düzenli çizgiyi kesin kanıt saymaz. Belki bu çizgi yalnızca soğuma geriliminin sonucudur.",
            fit: "Lav belleği, görsel ritim ve bilimsel ihtiyatı aynı hatta toplar.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Nötrino Notası",
            premise:
              "Derin uzay dinleme ekibi geciken sinyali önce gürültü olarak ele alır. Belki bu gecikme ölçüm sınırını gösteriyordur.",
            fit: "Nötrino notası, zaman gecikmesini sakin bir araştırma sorusuna dönüştürür.",
          },
        ]),
      ),
    ).toThrow(/uncertainty opener "belki bu"/i);
  });

  it("rejects generic unknown-species boilerplate repeated across the idea slate", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            title: "Android Mezarlığı",
            premise:
              "Ay yüzeyindeki paslı mezarlık bilinmeyen bir türün bilgi sistemlerini saklıyor olabilir.",
            fit: "Android mezarlığı, bilinmeyen bir tür arşivini temkinli bir görsel soruya çevirir.",
          },
          {
            ...validIdea,
            id: "idea_002",
            title: "Yörünge Teybi",
            premise:
              "Eski istasyon kaydı bilinmeyen bir türün izlerini saklıyor olabilir ama kesin kanıt değildir.",
            fit: "Yörünge teybi, bilinmeyen bir tür izini kanıt iddiası kurmadan inceler.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Sonda Günlüğü",
            premise:
              "Otonom keşif sondası bilinmeyen bir yaşam türü hakkında bilgi toplayabilir varsayımıyla ilerler.",
            fit: "Sonda günlüğü, bilinmeyen bir yaşam türü ihtimalini ölçülü bir kayıt anlatısına bağlar.",
          },
        ]),
      ),
    ).toThrow(/generic "bilinmeyen bir tür" boilerplate/i);
  });

  it("rejects repeated weak premise action boilerplate across repaired local-model ideas", () => {
    expect(() =>
      parseIdeasProviderPayload(
        JSON.stringify([
          {
            ...validIdea,
            premise:
              "Arşivci eski defterde bilgiyi bulduktan sonra buzaltı kaydının kesin kanıt olmadığını not eder.",
          },
          {
            ...validIdea,
            id: "idea_002",
            title: "Lav Belleği",
            premise:
              "Jeolog lav içinde bilgiyi bulduktan sonra mineral düzeninin doğal süreç olabileceğini sorgular.",
            fit: "Lav belleği, ölçüm ve görsel ritim arasında farklı bir bağ kurar.",
          },
          {
            ...validIdea,
            id: "idea_003",
            title: "Nötrino Gecikmesi",
            premise:
              "Matematikçi sinyal arasında bilgiyi bulduktan sonra gecikmiş ölçümün sınırlarını inceler.",
            fit: "Nötrino gecikmesi, veri kuşkusu ve sakin anlatı vaadini birleştirir.",
          },
        ]),
      ),
    ).toThrow(/generic "bilgiyi bulduktan sonra" boilerplate/i);
  });
});
