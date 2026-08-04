import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ManualField, inputCls } from "../components/permits/PermitUI";
import { MUNICIPALITIES, money } from "../lib/permits";
import { calcFees, getTariff, type Kullanim, type Tariff } from "../lib/tariff";

const YEARS = [0, 1].map((d) => new Date().getFullYear() - d);

/**
 * Dosya açmadan hızlı harç hesabı — TBB'nin kaldırılan harç hesaplama aracının
 * yerini tutar. Birim fiyatlar Tarife sayfasındaki belediye kaydından gelir;
 * uygulama hiçbir tutarı kendi kendine varsaymaz.
 */
export default function CalculatorPage() {
  const [municipality, setMunicipality] = useState(MUNICIPALITIES[0].name);
  const [year, setYear] = useState(YEARS[0]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [area, setArea] = useState(0);
  const [parcel, setParcel] = useState(0);
  const [units, setUnits] = useState(0);
  const [usage, setUsage] = useState<Kullanim>("konut");

  useEffect(() => {
    void (async () => {
      setLoaded(false);
      setTariff(await getTariff(municipality, year));
      setLoaded(true);
    })();
  }, [municipality, year]);

  const lines = tariff ? calcFees(tariff, { area, usage, units, parcel }).filter((l) => l.amount > 0) : [];
  const total = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-widest text-hivis">Araç</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Harç Hesaplama</h1>
      <p className="mt-2 max-w-2xl text-sm text-dim">
        Dosya açmadan tek ekranda hesap. Belediye ve yılı seç, alanları gir — kalemler ve toplam anında
        çıkar. Birim fiyatlar{" "}
        <Link to="/tarife" className="text-hivis underline">
          Tarife sayfasındaki
        </Link>{" "}
        kayıttan okunur.
      </p>

      <div className="mt-8 grid gap-3 rounded-sm border border-line bg-surface p-5 sm:grid-cols-3">
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
        <ManualField label="Kullanım türü">
          <select value={usage} onChange={(e) => setUsage(e.target.value as Kullanim)} className={inputCls}>
            <option value="konut">Konut</option>
            <option value="isyeri">İşyeri</option>
          </select>
        </ManualField>
        <ManualField label="Toplam inşaat alanı (m²)">
          <input type="number" min="0" value={area || ""} onChange={(e) => setArea(Number(e.target.value))} className={inputCls} />
        </ManualField>
        <ManualField label="Parsel alanı (m²)">
          <input type="number" min="0" value={parcel || ""} onChange={(e) => setParcel(Number(e.target.value))} className={inputCls} />
        </ManualField>
        <ManualField label="Bağımsız bölüm sayısı">
          <input type="number" min="0" value={units || ""} onChange={(e) => setUnits(Number(e.target.value))} className={inputCls} />
        </ManualField>
      </div>

      {loaded && !tariff && (
        <p className="mt-6 rounded-sm border border-hivis/40 bg-hivis/10 px-4 py-3 text-sm text-ink">
          {municipality} için {year} tarifesi kayıtlı değil.{" "}
          <Link to="/tarife" className="font-semibold text-hivis underline">
            Birim fiyatları gir
          </Link>
          , hesap otomatik çalışsın.
        </p>
      )}

      {tariff && (
        <>
          <div className="mt-6 overflow-x-auto rounded-sm border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface font-mono text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-4 py-3">Kalem</th>
                  <th className="px-4 py-3">Hesap</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.label} className="border-t border-line-soft">
                    <td className="px-4 py-3 font-semibold text-ink">{l.label}</td>
                    <td className="px-4 py-3 text-xs text-faint">{l.basis}</td>
                    <td className="px-4 py-3 text-right font-mono text-dim">{money(l.amount)}</td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-faint">
                      Alanları gir — hesaplanan kalemler burada listelenir.
                    </td>
                  </tr>
                )}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="border-t border-line bg-surface">
                    <td colSpan={2} className="px-4 py-3 font-semibold text-ink">
                      Toplam
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-lg font-bold text-hivis">{money(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-sm border border-line px-4 py-2 text-xs font-semibold text-dim hover:border-hivis hover:text-hivis"
            >
              Yazdır / PDF
            </button>
            <span className="text-[11px] text-faint">
              Kaynak: {tariff.source || "belirtilmemiş"} · Bu hesap ön bilgidir, belediyenin tahakkuku esastır.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
