export function standardContinuationChunk(chunkIndex: number): string[] {
  if (chunkIndex === 1) return continuationChunkOne;
  if (chunkIndex === 2) return continuationChunkTwo;
  return continuationChunkThree;
}

export function underfilledContinuationChunk(chunkIndex: number): string[] {
  const chunkName = ["ilk", "ikinci", "üçüncü"][chunkIndex - 1] ?? "ek";
  return [
    `Anlatıcı: Bu ${chunkName} ek parça sahneyi yalnızca kısa bir ölçüm notuyla genişletir.`,
    `Görsel: ${chunkName} veri çizgisi yavaşça söner ve ekip sonucu aceleyle kesinleştirmez.`,
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

const continuationChunkThree = [
  "Anlatıcı: Son köprüde ekip, verinin eksik kalan yanını tek bir kesin sonuca bağlamadan yeniden tartar. Ölçümün hangi saniyede güçlendiği, hangi sıcaklık aralığında zayıfladığı ve sondanın kendi hareketinden ne kadar etkilenmiş olabileceği ayrı ayrı okunur. Bu okumalar dramatik finali geciktirmez; aksine finalin daha güvenilir hissedilmesini sağlar. Görsel: Harita üzerinde olası doğal süreç, cihaz etkisi ve bilinmeyen değişken başlıkları sade biçimde yanar. Her başlığın altında kısa bir not belirir; doğal süreç için gelgit zorlanması, cihaz etkisi için titreşim sapması, bilinmeyen değişken için tekrar ölçüm ihtiyacı yazılır. Bu ek, sahneyi büyütmek yerine ritmi tamamlar ve izleyiciyi kapanışa daha sakin taşır.",
  "Anlatıcı: Böylece anlatı, büyük iddiayı değil araştırma disiplinini öne çıkarır; bir ölçümün değerini, hemen cevap vermesinde değil daha iyi gözlem gerektirmesinde arar. Anlatıcı son cümlelerde kesinlik hissini özellikle yumuşatır: Eğer bu işaret doğal bir süreçse, uzak dünyanın iç yapısı sandığımızdan daha hareketlidir; eğer cihaz kaynaklıysa, iyi bilimin en temel refleksi olan kontrol ve tekrar yeniden devrededir; eğer ikisinin dışında bir şey varsa, onu anlamak için daha çok veriye ihtiyaç vardır. Görsel: Sondanın ışığı buz altı karanlıkta dar bir çizgi bırakır, sonra görüntü yavaşça kontrol odasındaki sessiz bekleyişe döner. Ekip kutlama yapmaz; ekranı kapatmadan önce bir sonraki ölçüm penceresini işaretler. Kapanış kartı, cevaptan çok sorunun kalitesini hatırlatır. Son saniyede kamera yeniden buz yüzeyine çıkar; dışarıdan bakıldığında her şey sessizdir, fakat izleyici artık bu sessizliğin ölçüm, sabır ve dikkat isteyen canlı bir problem olduğunu bilir. Böyle kapanan bölüm, sonraki videoya da doğal ve kontrollü bir merak köprüsü bırakır.",
];
