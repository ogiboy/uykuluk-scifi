export function standardContinuationChunk(chunkIndex: number): string[] {
  return chunkIndex === 1 ? continuationChunkOne : continuationChunkTwo;
}

export function underfilledContinuationChunk(chunkIndex: number): string[] {
  const chunkName = chunkIndex === 1 ? "ilk" : "ikinci";
  return [
    `Anlatıcı: Bu ${chunkName} ek parça sahneyi yalnızca kısa bir ölçüm notuyla genişletir.`,
    "Görsel: Veri çizgisi yavaşça söner ve ekip sonucu aceleyle kesinleştirmez.",
  ];
}

const continuationChunkOne = [
  "Anlatıcı: Sonda aynı yankıyı ikinci kez dinlediğinde, hikâye daha geniş bir nefes alır. Önce cihaz hatası olasılığı masaya yatırılır; kablo bağlantıları, zaman damgaları, sıcaklık farkları ve buz yüzeyindeki titreşimler tek tek karşılaştırılır. Görsel: Kontrol panelinde üç ayrı grafik yavaşça üst üste biner; hiçbir çizgi tek başına büyük bir iddia taşımaz, ama birlikte bakıldığında dikkatli bir desen önerir. Bu bölümde merak, aceleci bir keşif anı gibi değil, sabırla büyüyen bir soru gibi ilerler.",
  "Anlatıcı: Buzun altında hayal edilen okyanus, yalnızca dramatik bir dekor değildir; basınç, tuzluluk, mineral akışı ve gelgit enerjisi gibi unsurların bir araya geldiği karmaşık bir ortamdır. Bilimsel ihtiyat burada anlatının merkezinde kalır: düzenli görünen her işaret biyolojik değildir, her ışık yaşam değildir, her ritim mesaj değildir. Görsel: Mavi karanlığın içinde küçük mineral parçacıkları ağır çekimde dönerken, ekranda kısa notlar belirir ve her olasılık kendi sınırıyla birlikte anılır.",
  "Anlatıcı: Kontrol ekibi bu veriyi tek bir dramatik sonuca bağlamak yerine, ölçümün çevresindeki koşulları genişletir. Yüzey sıcaklığı, buz kalınlığı, yankının geliş açısı ve sondanın kendi titreşimi aynı tabloda yeniden okunur. Görsel: Ekran ikiye bölünür; bir tarafta ham veri, diğer tarafta olası açıklamalar sakin kartlar halinde akar. İzleyici burada cevaptan çok yöntemi görür; çünkü iyi bir UykulukSciFi anlatısı, bilinmeyeni büyütürken güvenilir düşünme biçimini de görünür kılar.",
  "Anlatıcı: Bu ek derinleşme sahnenin temposunu yavaşlatır ama gerilimi azaltmaz. Tam tersine, her kontrol adımı okyanusun karanlığını daha anlamlı yapar; çünkü yanlış ihtimalleri ayıklamak, geriye kalan soruyu daha berrak hale getirir. Görsel: Sonda buzun altındaki sessiz boşlukta ilerlerken, ışığı yalnızca birkaç metreyi aydınlatır. Karanlık mutlak bir tehdit gibi değil, sabır isteyen bir araştırma alanı gibi sunulur.",
];

const continuationChunkTwo = [
  "Anlatıcı: Üçüncü ölçümde sonda, yankının yalnızca zamana değil, buz kabuğunun çatlak haritasına da bağlı olabileceğini fark eder. Bu, kesin bir cevap vermez; ama sahnenin bilimkurgu tarafını güçlendiren daha iyi bir gerilim kurar. Görsel: Kamera çatlakların arasından aşağı iner, sonra okyanusun karanlık yüzeyinde neredeyse görünmeyen bir akıntıyı takip eder. Verinin kendisi küçük kalır, fakat sorunun ölçeği büyür: Bir dünyanın iç hareketi, dışarıdan bakıldığında nasıl sessizlik gibi görünebilir?",
  "Anlatıcı: Kapanışa yaklaşmadan önce anlatı bir kez daha temkinli davranır. Eğer bu ritim jeolojikse, yine de gezegenin sanıldığından daha etkin olduğunu gösterir; eğer kimyasalsa, buz altı okyanusun beklenmedik döngüler taşıyabileceğini düşündürür; eğer cihaz kaynaklıysa, iyi bilimin neden tekrar ve kontrol istediğini hatırlatır. Görsel: Sonda ışığını kısar, veri çizgileri sadeleşir ve müzik neredeyse duyulmayacak kadar alçalır. Böylece final, abartılı bir keşif yerine, izleyicinin zihninde sakin ama güçlü bir olasılık bırakır.",
  "Anlatıcı: Bu olasılıkların her biri farklı bir görsel ritim doğurur. Jeolojik açıklamada buz kabuğu yavaşça esner; kimyasal açıklamada mineral bulutları suyun içinde puslu bir harita oluşturur; cihaz açıklamasında ise kontrol odası sessizleşir ve ekip tekrar ölçüm ister. Görsel: Üç kısa sahne arka arkaya gelir, fakat hiçbiri tek başına nihai cevap gibi sunulmaz. Böylece izleyici, bilimsel belirsizliğin hikâyeyi zayıflatmadığını, aksine daha dürüst ve daha merak uyandırıcı yaptığını hisseder.",
  "Anlatıcı: Final köprüsü bu nedenle yumuşak kalır. Sonda karanlıkta ilerlerken, anlatı bize yalnızca uzak bir okyanusu değil, bilinmeyene yaklaşma biçimimizi de düşündürür. Bazen en değerli keşif, bir şeyi bulduğumuzu ilan etmek değil, daha iyi bir soru sormayı öğrenmektir. Görsel: Veri akışı yavaşça kaybolur, buz yüzeyi uzaktan yeniden görünür ve gezegenin sessizliği artık boşluk değil, dikkatle dinlenmesi gereken bir davet gibi durur.",
];
