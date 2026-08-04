import { emptyTariff, type Tariff } from "./tariff";

/**
 * Hazır tarifeler — yalnızca DOĞRULANMIŞ kaynaktan girilir.
 * Her kaydın `source` alanı belediyenin yayımladığı belgeyi gösterir.
 * Kaynağı olmayan rakam eklenmez; okunamayan kalem 0 bırakılır.
 */

/* --------------------------- Bağcılar 2026 --------------------------- *
 * Kaynak: Bağcılar Belediyesi 2026 Yılı Ücret Tarifeleri (PDF),
 *   https://www.bagcilar.bel.tr/Files/Dokuman/2026_yili_ucret_tarifeleri.pdf
 * İmar ve Şehircilik Müdürlüğü bölümü (Sayfa 7–9).
 *
 * ÖNEMLİ: Bağcılar tarifesinde bina inşaat harcı ve iskan harcı için tutar
 * yazmaz — "2464 sayılı Belediye Gelirleri Kanununun ilgili maddesine göre
 * tahsil edilir" denir. Bu iki kalem 0 bırakıldı; kanun tarifesindeki güncel
 * m² tutarlarını belediyeden teyit edip Tarife sayfasından girin.
 * -------------------------------------------------------------------- */
const bagcilar2026: Tariff = {
  ...emptyTariff("Bağcılar Belediyesi", 2026),
  source: "Bağcılar Belediyesi 2026 Yılı Ücret Tarifeleri, İmar ve Şehircilik Müd. (s. 7–9)",
  // Parsel 0-500 m² kademesi baz alındı; büyük parsellerde 11.960,00 ₺
  aplikasyon: 4740,
  kotKesit: 4740,
  imarDurumu: 1190, // 0-100 m² parsel sabit tutarı; m² bileşeni extras'ta
  extras: [
    {
      label: "İmar durumu — parsel m² bileşeni (100 m² üzeri)",
      taskTitle: "İmar durum belgesi",
      mode: "parselM2",
      amount: 3,
    },
    {
      label: "İnşaat istikamet rölevesi (0-500 m² parsel)",
      taskTitle: "Aplikasyon krokisi",
      mode: "sabit",
      amount: 4740,
    },
    {
      label: "Isı yalıtım ücreti (konut)",
      taskTitle: "Yapı ruhsatı belgesi",
      mode: "insaatM2",
      amount: 13,
    },
    {
      label: "İskan rapor ücreti",
      taskTitle: "Yapı kullanma izni (iskan) başvurusu",
      mode: "insaatM2",
      amount: 125,
    },
    {
      label: "Otopark rapor ücreti (1.250 m² üzeri yapılar)",
      taskTitle: "Harç ve otopark bedeli dekontları",
      mode: "sabit",
      amount: 6435,
    },
  ],
};

export const TARIFF_PRESETS: Tariff[] = [bagcilar2026];

export const presetFor = (municipality: string, year: number) =>
  TARIFF_PRESETS.find((t) => t.municipality === municipality && t.year === year) ?? null;
