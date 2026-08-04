import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ManualField, inputCls } from "./PermitUI";
import { money, type PermitProject, type PermitTask } from "../../lib/permits";
import { calcFees, getTariff, groupByTask, missingRates, type FeeLine, type Tariff } from "../../lib/tariff";

/**
 * Belediye + m² girildiğinde harçları tarifeden hesaplar ve tek tıkla
 * ilgili evrakların "ödenen harç" alanına yazar.
 */
export default function FeeCalculator({
  project,
  tasks,
  onPatchProject,
  onApply,
}: {
  project: PermitProject;
  tasks: PermitTask[];
  onPatchProject: (patch: Partial<PermitProject>) => void;
  onApply: (byTask: Record<string, number>) => void;
}) {
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoaded(false);
      setTariff(await getTariff(project.municipality));
      setLoaded(true);
    })();
  }, [project.municipality]);

  const area = project.area_m2 ?? 0;
  const units = project.unit_count ?? 0;
  const parcel = project.parcel_m2 ?? 0;
  const lines: FeeLine[] = tariff ? calcFees(tariff, { area, usage: project.usage, units, parcel }) : [];
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const missing = tariff ? missingRates(tariff, project.usage) : [];

  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-hivis">Harç Hesabı · otomatik</p>
          <p className="mt-1 text-sm text-dim">
            {project.municipality} — {tariff ? `${tariff.year} tarifesi` : "tarife girilmemiş"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-wide text-faint">Hesaplanan toplam</p>
          <p className="text-2xl font-bold text-ink">{money(total)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <ManualField label="İnşaat alanı (m²)">
          <input
            type="number"
            min="0"
            defaultValue={project.area_m2 ?? ""}
            onBlur={(e) => onPatchProject({ area_m2: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
          />
        </ManualField>
        <ManualField label="Kullanım türü">
          <select
            value={project.usage}
            onChange={(e) => onPatchProject({ usage: e.target.value as PermitProject["usage"] })}
            className={inputCls}
          >
            <option value="konut">Konut</option>
            <option value="isyeri">İşyeri</option>
          </select>
        </ManualField>
        <ManualField label="Parsel alanı (m²)">
          <input
            type="number"
            min="0"
            defaultValue={project.parcel_m2 ?? ""}
            onBlur={(e) => onPatchProject({ parcel_m2: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
          />
        </ManualField>
        <ManualField label="Bağımsız bölüm sayısı">
          <input
            type="number"
            min="0"
            defaultValue={project.unit_count ?? ""}
            onBlur={(e) => onPatchProject({ unit_count: e.target.value ? Number(e.target.value) : null })}
            className={inputCls}
          />
        </ManualField>
      </div>

      {loaded && !tariff && (
        <p className="mt-4 rounded-sm border border-hivis/40 bg-hivis/10 px-3 py-2.5 text-sm text-ink">
          Bu belediye için {new Date().getFullYear()} tarifesi yok.{" "}
          <Link to="/tarife" className="font-semibold text-hivis underline">
            Tarife sayfasından birim fiyatları gir
          </Link>{" "}
          — sonrası otomatik hesaplanır.
        </p>
      )}

      {tariff && missing.length > 0 && (
        <p className="mt-4 rounded-sm border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-3 py-2.5 text-xs text-[#ff8f8f]">
          Eksik birim fiyat: {missing.join(", ")} — bu kalemler 0 ₺ hesaplanıyor.{" "}
          <Link to="/tarife" className="underline">
            Tarifeyi tamamla
          </Link>
        </p>
      )}

      {tariff && area > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-4 text-xs font-semibold text-hivis"
          >
            {open ? "Kalemleri gizle ▲" : "Kalemleri göster ▼"}
          </button>

          {open && (
            <div className="mt-3 overflow-x-auto rounded-sm border border-line-soft">
              <table className="w-full text-left text-xs">
                <thead className="bg-base font-mono text-[10px] uppercase tracking-wide text-faint">
                  <tr>
                    <th className="px-3 py-2">Kalem</th>
                    <th className="px-3 py-2">Hesap</th>
                    <th className="px-3 py-2">İşleneceği evrak</th>
                    <th className="px-3 py-2 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.label} className="border-t border-line-soft">
                      <td className="px-3 py-2 font-semibold text-ink">{l.label}</td>
                      <td className="px-3 py-2 text-faint">{l.basis}</td>
                      <td className="px-3 py-2 text-dim">{l.taskTitle}</td>
                      <td className="px-3 py-2 text-right font-mono text-dim">{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={total <= 0}
              onClick={() => {
                const byTask = groupByTask(lines);
                const hit = tasks.filter((t) => byTask[t.title] !== undefined).length;
                if (!hit) return;
                if (!window.confirm(`${hit} evrağın harç alanı hesaplanan tutarla güncellensin mi?`)) return;
                onApply(byTask);
              }}
              className="rounded-sm bg-hivis px-4 py-2 text-xs font-semibold text-hivis-ink disabled:bg-line disabled:text-faint"
            >
              Evraklara işle
            </button>
            <Link to="/tarife" className="text-xs text-dim hover:text-hivis">
              Tarifeyi düzenle →
            </Link>
            <span className="text-[11px] text-faint">
              Tutarlar girdiğin tarifeden hesaplanır; belediyenin tahakkukuyla kontrol et.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
