import { useEffect, useState } from "react";
import { ManualField, inputCls } from "../components/permits/PermitUI";
import { MUNICIPALITIES, STAGES } from "../lib/permits";
import {
  EXTRA_MODES,
  emptyTariff,
  getTariff,
  saveTariff,
  type Bracket,
  type Extra,
  type Kullanim,
  type Tariff,
} from "../lib/tariff";
import { presetFor } from "../lib/tariffPresets";

const YEARS = [0, 1].map((d) => new Date().getFullYear() - d);
const TASK_TITLES = STAGES.flatMap((s) => s.tasks);

/** Belediye başına birim fiyat girişi — hesap motorunun tek veri kaynağı */
export default function TariffPage() {
  const [municipality, setMunicipality] = useState(MUNICIPALITIES[0].name);
  const [year, setYear] = useState(YEARS[0]);
  const [t, setT] = useState<Tariff>(() => emptyTariff(MUNICIPALITIES[0].name));
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const found = await getTariff(municipality, year);
      setT(found ?? { ...emptyTariff(municipality, year) });
      setLoading(false);
    })();
  }, [municipality, year]);

  const preset = presetFor(municipality, year);

  const setExtra = (i: number, patch: Partial<Extra>) =>
    setT((prev) => ({ ...prev, extras: prev.extras.map((x, k) => (k === i ? { ...x, ...patch } : x)) }));

  const num = (v: string) => (v ? Number(v) : 0);

  const setBracket = (usage: Kullanim, i: number, perM2: number) =>
    setT((prev) => ({
      ...prev,
      binaInsaatHarci: {
        ...prev.binaInsaatHarci,
        [usage]: prev.binaInsaatHarci[usage].map((b, k) => (k === i ? { ...b, perM2 } : b)),
      },
    }));

  const onSave = async () => {
    await saveTariff({ ...t, municipality, year });
    setMsg("Tarife kaydedildi. Proje sayfalarındaki harç hesabı bu değerleri kullanır.");
    setTimeout(() => setMsg(null), 2500);
  };

  const label = (b: Bracket, i: number, arr: Bracket[]) => {
    const prev = i === 0 ? 0 : (arr[i - 1].upTo ?? 0);
    return b.upTo === null ? `${prev} m² üzeri` : `${prev + 1}–${b.upTo} m²`;
  };

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-hivis">Ayarlar</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Belediye Harç Tarifesi</h1>
      <p className="mt-2 max-w-2xl text-sm text-dim">
        Belediyelerin harç tarifeleri için ortak bir veri servisi yok; her belediye tarifesini yılda bir
        meclis kararıyla yayımlar. Birim fiyatları buraya bir kez girersin, proje sayfasında m² yazdığında
        tüm harçlar otomatik hesaplanır. Dilim yapısı 2464 sayılı Belediye Gelirleri Kanunu'nu izler.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <ManualField label="Belediye">
          <select value={municipality} onChange={(e) => setMunicipality(e.target.value)} className={inputCls}>
            {MUNICIPALITIES.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </ManualField>
        <ManualField label="Tarife yılı">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </ManualField>
        <ManualField label="Kaynak" hint="karar no / bağlantı">
          <input
            value={t.source}
            onChange={(e) => setT({ ...t, source: e.target.value })}
            placeholder="2026 Gelir Tarifesi, Meclis Kararı 12/4"
            className={inputCls}
          />
        </ManualField>
      </div>

      {preset && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-hivis/40 bg-hivis/10 px-4 py-3">
          <p className="text-sm text-ink">
            {municipality} {year} için doğrulanmış tarife kayıtlı — kaynak: {preset.source}
          </p>
          <button
            type="button"
            onClick={() => setT({ ...preset })}
            className="rounded-sm bg-hivis px-3 py-1.5 text-xs font-semibold text-hivis-ink"
          >
            Hazır tarifeyi yükle
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-dim">Yükleniyor…</p>
      ) : (
        <>
          {/* Bina inşaat harcı — dilimli */}
          <h2 className="mt-10 font-display text-lg font-bold text-ink">Bina inşaat harcı (₺/m²)</h2>
          <p className="mt-1 text-xs text-faint">Her dilim kendi birim fiyatıyla çarpılır, tutarlar toplanır.</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {(["konut", "isyeri"] as const).map((usage) => (
              <div key={usage} className="rounded-sm border border-line bg-surface p-4">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-hivis">
                  {usage === "konut" ? "Konut" : "İşyeri"}
                </p>
                <div className="space-y-2">
                  {t.binaInsaatHarci[usage].map((b, i, arr) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-xs text-dim">{label(b, i, arr)}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={b.perM2 || ""}
                        onChange={(e) => setBracket(usage, i, num(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Diğer kalemler */}
          <h2 className="mt-10 font-display text-lg font-bold text-ink">Diğer harç ve ücretler</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Num
              label="Yapı kullanma izni — konut (₺/m²)"
              value={t.yapiKullanmaHarci.konut}
              onChange={(v) => setT({ ...t, yapiKullanmaHarci: { ...t.yapiKullanmaHarci, konut: v } })}
            />
            <Num
              label="Yapı kullanma izni — işyeri (₺/m²)"
              value={t.yapiKullanmaHarci.isyeri}
              onChange={(v) => setT({ ...t, yapiKullanmaHarci: { ...t.yapiKullanmaHarci, isyeri: v } })}
            />
            <Num
              label="Otopark bedeli (₺ / bağımsız bölüm)"
              value={t.otoparkBedeli}
              onChange={(v) => setT({ ...t, otoparkBedeli: v })}
            />
            <Num label="İmar durumu ücreti (₺)" value={t.imarDurumu} onChange={(v) => setT({ ...t, imarDurumu: v })} />
            <Num label="Aplikasyon ücreti (₺)" value={t.aplikasyon} onChange={(v) => setT({ ...t, aplikasyon: v })} />
            <Num label="Kot-kesit ücreti (₺)" value={t.kotKesit} onChange={(v) => setT({ ...t, kotKesit: v })} />
            <Num label="Zemin etüdü (₺/m²)" value={t.zeminEtutM2} onChange={(v) => setT({ ...t, zeminEtutM2: v })} />
            <Num
              label="Yapı yaklaşık birim maliyeti (₺/m²)"
              value={t.yaklasikBirimMaliyet}
              onChange={(v) => setT({ ...t, yaklasikBirimMaliyet: v })}
            />
            <Num
              label="Yapı denetim oranı (%)"
              value={t.yapiDenetimOrani}
              onChange={(v) => setT({ ...t, yapiDenetimOrani: v })}
            />
          </div>

          {/* Belediyeye özgü ek ücretler */}
          <h2 className="mt-10 font-display text-lg font-bold text-ink">Ek ücretler</h2>
          <p className="mt-1 text-xs text-faint">
            Isı yalıtım, iskan rapor, otopark rapor gibi belediyeye özel kalemler. Matrah seçilir, sistem
            çarpar ve seçtiğin evrağın harç alanına yazar.
          </p>
          <div className="mt-4 space-y-2">
            {(t.extras ?? []).map((x, i) => (
              <div key={i} className="grid gap-2 rounded-sm border border-line bg-surface p-3 md:grid-cols-[2fr_1.5fr_1fr_0.8fr_auto]">
                <input
                  value={x.label}
                  onChange={(e) => setExtra(i, { label: e.target.value })}
                  placeholder="Kalem adı"
                  className={inputCls}
                />
                <select
                  value={x.taskTitle}
                  onChange={(e) => setExtra(i, { taskTitle: e.target.value })}
                  className={inputCls}
                >
                  {TASK_TITLES.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
                <select
                  value={x.mode}
                  onChange={(e) => setExtra(i, { mode: e.target.value as Extra["mode"] })}
                  className={inputCls}
                >
                  {EXTRA_MODES.map(([mode, label]) => (
                    <option key={mode} value={mode}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={x.amount || ""}
                  onChange={(e) => setExtra(i, { amount: num(e.target.value) })}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setT({ ...t, extras: t.extras.filter((_, k) => k !== i) })}
                  className="rounded-sm border border-line px-3 text-xs text-faint hover:border-[#ff6b6b] hover:text-[#ff8f8f]"
                >
                  Sil
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setT({
                  ...t,
                  extras: [...(t.extras ?? []), { label: "", taskTitle: TASK_TITLES[0], mode: "sabit", amount: 0 }],
                })
              }
              className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-dim hover:border-hivis hover:text-hivis"
            >
              + Ek ücret satırı
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void onSave()}
              className="rounded-sm bg-hivis px-6 py-2.5 text-sm font-semibold text-hivis-ink hover:bg-[#e8c67a]"
            >
              Tarifeyi kaydet
            </button>
            {t.updated_at && (
              <span className="text-xs text-faint">
                Son güncelleme: {new Date(t.updated_at).toLocaleDateString("tr-TR")}
              </span>
            )}
            {msg && <span className="text-xs font-semibold text-[#5ae5a0]">{msg}</span>}
          </div>

          <p className="mt-6 text-xs text-faint">
            Girilen değerler resmî kaynak değildir — belediyenin yayımladığı güncel tarifeden kontrol et.
            Tahakkuk farkı olursa evrak satırındaki harç alanını elle düzeltebilirsin.
          </p>
        </>
      )}
    </section>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <ManualField label={label}>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value || ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : 0)}
        className={inputCls}
      />
    </ManualField>
  );
}
