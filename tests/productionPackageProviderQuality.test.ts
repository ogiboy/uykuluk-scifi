import { describe, expect, it } from "vitest";
import { assertProductionPackageProviderQuality } from "../src/stages/production/productionPackageProviderQuality";

const validPayload = {
  popupCards: ["Organik sinyal tek başına yaşam kanıtı değildir."],
  lowerThirds: ["Ötegezegen jeolojisi", "Bağımsız ölçüm"],
  youtube: {
    title: "Kumtaşı Bir Gezegenin Geçmişini Saklayabilir mi?",
    description: "Bir jeoloğun organik sinyali dikkatli yöntemlerle sınadığı bilimkurgu anlatısı.",
    tags: ["ötegezegen", "kumtaşı", "bilimkurgu"],
  },
};

describe("production package provider quality", () => {
  it("accepts Turkish metadata aligned with the approved script", () => {
    expect(() =>
      assertProductionPackageProviderQuality(
        validPayload,
        "Anlatıcı: Jeolog, kumtaşı örneğini dikkatle inceler.",
      ),
    ).not.toThrow();
  });

  it("blocks invented named experts and English YouTube tags", () => {
    expect(() =>
      assertProductionPackageProviderQuality(
        {
          ...validPayload,
          youtube: { ...validPayload.youtube, description: "Jeolog Dr. Elara, numuneyi inceler." },
        },
        "Anlatıcı: Jeolog, kumtaşı örneğini dikkatle inceler.",
      ),
    ).toThrow("introduces a named person absent from the approved script");

    expect(() =>
      assertProductionPackageProviderQuality(
        { ...validPayload, youtube: { ...validPayload.youtube, tags: ["geological analysis"] } },
        "Anlatıcı: Jeolog, kumtaşı örneğini dikkatle inceler.",
      ),
    ).toThrow("contains English YouTube tags");
  });
});
