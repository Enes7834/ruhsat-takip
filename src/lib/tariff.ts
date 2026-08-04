import { supabase } from "./supabase";

/* ------------------------------------------------------------------ *
 * Belediye harç tarifesi ve otomatik hesap
 *
 * ÖNEMLİ: Tutarlar uygulamayla birlikte gelmez. Belediyelerin harç
 * tarifeleri için ortak bir API yoktur; her belediye kendi meclis
 * kararıyla yılda bir yayımlar. Bu yüzden birim fiyatlar BİR KEZ elle
 * girilir (Tarife sayfası), hesap otomatik yapılır.
 *
 * Hesap iskeleti 2464 sayılı Belediye Gelirleri Kanunu'nun bina inşaat
 * harcı dilim yapısını izler; dilim sınırları sabittir, ₺ tutarları
 * her yıl değişir — o yüzden tutarlar tarifede tutulur.
 * ------------------------------------------------------------------ */

export type Kullanim = "konut" | "isyeri";

/** m² dilimi: `upTo` null ise "ve fazlası" */
export type Bracket = { upTo: number | null; perM2: number };

export type Tariff = {
  municipality: string;
  year: number;
  /** Tarifenin alındığı karar/sayfa — doğrulanabilir olsun diye zorunlu tutulur */
  source: string;
  updated_at: string;

  /** 2464 s.K. bina inşaat harcı — dilimli, ₺/m² */
  binaInsaatHarci: Record<Kullanim, Bracket[]>;
  /** Yapı kullanma izni (iskan) harcı — ₺/m² */
  yapiKullanmaHarci: Record<Kullanim, number>;
  /** Otopark bedeli — ₺ / bağımsız bölüm */
  otoparkBedeli: number;
  /** Sabit ücretli evraklar (₺) */
  imarDurumu: number;
  aplikasyon: number;
  kotKesit: number;
  /** Zemin etüdü — ₺/m² */
  zeminEtutM2: number;
  /** Yapı denetim hizmet bedeli oranı (%) */
  yapiDenetimOrani: number;
  /** Yapı yaklaşık birim maliyeti — ₺/m² (yapı denetim bedelinin matrahı) */
  yaklasikBirimMaliyet: number;
  /** Belediyeye özgü ek ücretler (ısı yalıtım, iskan rapor, otopark rapor…) */
  extras: Extra[];
};

/** Ek kalem: tutar sabit olabilir ya da bir matrahla çarpılır */
export type Extra = {
  label: string;
  /** Hangi evrağın harç alanına yazılacağı */
  taskTitle: string;
  mode: "sabit" | "insaatM2" | "parselM2" | "bagimsizBolum";
  amount: number;
};

const MODE_LABEL: Record<Extra["mode"], string> = {
  sabit: "Sabit ₺",
  insaatM2: "₺ × inşaat m²",
  parselM2: "₺ × parsel m²",
  bagimsizBolum: "₺ × bağımsız bölüm",
};

export const EXTRA_MODES = Object.entries(MODE_LABEL) as [Extra["mode"], string][];

const EMPTY_BRACKETS: Bracket[] = [
  { upTo: 100, perM2: 0 },
  { upTo: 120, perM2: 0 },
  { upTo: 150, perM2: 0 },
  { upTo: 200, perM2: 0 },
  { upTo: null, perM2: 0 },
];

/** Sıfır değerli iskelet — kullanıcı belediyenin yayımladığı tarifeden doldurur */
export function emptyTariff(municipality: string, year = new Date().getFullYear()): Tariff {
  return {
    municipality,
    year,
    source: "",
    updated_at: new Date().toISOString(),
    binaInsaatHarci: {
      konut: EMPTY_BRACKETS.map((b) => ({ ...b })),
      isyeri: EMPTY_BRACKETS.map((b) => ({ ...b })),
    },
    yapiKullanmaHarci: { konut: 0, isyeri: 0 },
    otoparkBedeli: 0,
    imarDurumu: 0,
    aplikasyon: 0,
    kotKesit: 0,
    zeminEtutM2: 0,
    yapiDenetimOrani: 0,
    yaklasikBirimMaliyet: 0,
    extras: [],
  };
}

/* ------------------------------- Hesap ------------------------------- */

export type FeeInput = {
  /** Toplam inşaat alanı (m²) */
  area: number;
  usage: Kullanim;
  /** Bağımsız bölüm sayısı — otopark bedeli için */
  units: number;
  /** Parsel alanı (m²) — imar durumu gibi parsele bağlı ücretler için */
  parcel: number;
};

export type FeeLine = {
  /** Tutarın işleneceği evrak başlığı (permits.ts kataloğuyla birebir) */
  taskTitle: string;
  label: string;
  amount: number;
  basis: string;
};

/** Dilimli hesap: her dilim kendi birim fiyatıyla çarpılır. */
export function bracketTotal(area: number, brackets: Bracket[]): { total: number; detail: string } {
  let remaining = area;
  let prev = 0;
  let total = 0;
  const parts: string[] = [];

  for (const b of brackets) {
    if (remaining <= 0) break;
    const cap = b.upTo === null ? Infinity : b.upTo;
    const slice = Math.min(remaining, cap - prev);
    if (slice > 0) {
      total += slice * b.perM2;
      if (b.perM2 > 0) parts.push(`${Math.round(slice)} m² × ${b.perM2} ₺`);
      remaining -= slice;
      prev = cap;
    }
  }
  return { total, detail: parts.join(" + ") || "birim fiyat girilmedi" };
}

export function calcFees(t: Tariff, input: FeeInput): FeeLine[] {
  const { area, usage, units, parcel } = input;
  const bina = bracketTotal(area, t.binaInsaatHarci[usage]);
  const insaatMaliyeti = area * t.yaklasikBirimMaliyet;

  const lines: FeeLine[] = [
    {
      taskTitle: "Harç ve otopark bedeli dekontları",
      label: "Bina inşaat harcı",
      amount: bina.total,
      basis: `${usage === "konut" ? "Konut" : "İşyeri"} dilimli: ${bina.detail}`,
    },
    {
      taskTitle: "Harç ve otopark bedeli dekontları",
      label: "Otopark bedeli",
      amount: units * t.otoparkBedeli,
      basis: `${units} bağımsız bölüm × ${t.otoparkBedeli} ₺`,
    },
    {
      taskTitle: "Yapı kullanma izni (iskan) başvurusu",
      label: "Yapı kullanma izni harcı",
      amount: area * t.yapiKullanmaHarci[usage],
      basis: `${area} m² × ${t.yapiKullanmaHarci[usage]} ₺`,
    },
    {
      taskTitle: "Yapı denetim sözleşmesi",
      label: "Yapı denetim hizmet bedeli",
      amount: (insaatMaliyeti * t.yapiDenetimOrani) / 100,
      basis: `${area} m² × ${t.yaklasikBirimMaliyet} ₺ × %${t.yapiDenetimOrani}`,
    },
    {
      taskTitle: "Zemin etüt raporu",
      label: "Zemin etüdü",
      amount: area * t.zeminEtutM2,
      basis: `${area} m² × ${t.zeminEtutM2} ₺`,
    },
    { taskTitle: "İmar durum belgesi", label: "İmar durumu ücreti", amount: t.imarDurumu, basis: "Sabit ücret" },
    { taskTitle: "Aplikasyon krokisi", label: "Aplikasyon ücreti", amount: t.aplikasyon, basis: "Sabit ücret" },
    { taskTitle: "Kot-kesit belgesi", label: "Kot-kesit ücreti", amount: t.kotKesit, basis: "Sabit ücret" },
  ];

  for (const e of t.extras ?? []) {
    const base =
      e.mode === "insaatM2" ? area : e.mode === "parselM2" ? parcel : e.mode === "bagimsizBolum" ? units : 1;
    lines.push({
      taskTitle: e.taskTitle,
      label: e.label,
      amount: base * e.amount,
      basis: e.mode === "sabit" ? "Sabit ücret" : `${base} × ${e.amount} ₺ (${MODE_LABEL[e.mode]})`,
    });
  }

  return lines;
}

/** Aynı evrağa düşen kalemleri toplar — fee_amount tek alan olduğu için */
export function groupByTask(lines: FeeLine[]): Record<string, number> {
  return lines.reduce<Record<string, number>>((acc, l) => {
    if (l.amount > 0) acc[l.taskTitle] = (acc[l.taskTitle] ?? 0) + l.amount;
    return acc;
  }, {});
}

/** Tarifede eksik kalan birim fiyatlar — kullanıcıya uyarı olarak gösterilir */
export function missingRates(t: Tariff, usage: Kullanim): string[] {
  const missing: string[] = [];
  if (t.binaInsaatHarci[usage].every((b) => b.perM2 === 0)) missing.push("Bina inşaat harcı");
  if (!t.yapiKullanmaHarci[usage]) missing.push("Yapı kullanma izni harcı");
  if (!t.otoparkBedeli) missing.push("Otopark bedeli");
  if (!t.yaklasikBirimMaliyet || !t.yapiDenetimOrani) missing.push("Yapı denetim bedeli");
  if (!t.source.trim()) missing.push("Tarife kaynağı");
  return missing;
}

/* ------------------------------ Depolama ------------------------------ */

const LS_KEY = "duran_permit_tariffs";

const readAll = (): Tariff[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Tariff[];
  } catch {
    return [];
  }
};

export async function listTariffs(): Promise<Tariff[]> {
  if (!supabase) return readAll();
  const { data } = await supabase.from("permit_tariffs").select("*").order("municipality");
  return (data as Tariff[]) ?? [];
}

export async function getTariff(municipality: string, year?: number): Promise<Tariff | null> {
  const all = await listTariffs();
  const y = year ?? new Date().getFullYear();
  return all.find((t) => t.municipality === municipality && t.year === y) ?? null;
}

export async function saveTariff(tariff: Tariff): Promise<void> {
  const next = { ...tariff, updated_at: new Date().toISOString() };
  if (!supabase) {
    const all = readAll().filter(
      (t) => !(t.municipality === next.municipality && t.year === next.year),
    );
    localStorage.setItem(LS_KEY, JSON.stringify([...all, next]));
    return;
  }
  const { error } = await supabase
    .from("permit_tariffs")
    .upsert(next, { onConflict: "municipality,year" });
  if (error) throw error;
}
