import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StageStepper, StatusBadge, ManualField, inputCls } from "../components/permits/PermitUI";
import {
  MUNICIPALITIES,
  PERMIT_DEMO,
  copyPermitProject,
  createPermitProject,
  deletePermitProject,
  deriveProject,
  listPermitProjects,
  listPermitTasks,
  money,
  type PermitProject,
  type PermitTask,
  type ProjectDerived,
} from "../lib/permits";

type Row = { project: PermitProject; d: ProjectDerived };
type SortKey = "recent" | "name" | "wait" | "fees" | "risk";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "En yeni",
  name: "Proje adı",
  wait: "Bekleme (uzun → kısa)",
  fees: "Harç (yüksek → düşük)",
  risk: "Risk (revizyon / süre)",
};

function sortRows(rows: Row[], key: SortKey): Row[] {
  const copy = [...rows];
  switch (key) {
    case "name":
      return copy.sort((a, b) => a.project.name.localeCompare(b.project.name, "tr"));
    case "wait":
      return copy.sort((a, b) => b.d.worstWaitDays - a.d.worstWaitDays);
    case "fees":
      return copy.sort((a, b) => b.d.totalFees - a.d.totalFees);
    case "risk":
      return copy.sort(
        (a, b) =>
          b.d.revisionCount * 100 + b.d.expiringCount * 10 + b.d.worstWaitDays -
          (a.d.revisionCount * 100 + a.d.expiringCount * 10 + a.d.worstWaitDays),
      );
    default:
      return copy.sort((a, b) => b.project.created_at.localeCompare(a.project.created_at));
  }
}

export default function PermitsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyRisky, setOnlyRisky] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [projects, tasks] = await Promise.all([listPermitProjects(), listPermitTasks()]);
      const byProject = new Map<string, PermitTask[]>();
      for (const t of tasks) {
        const list = byProject.get(t.project_id) ?? [];
        list.push(t);
        byProject.set(t.project_id, list);
      }
      setRows(projects.map((p) => ({ project: p, d: deriveProject(byProject.get(p.id) ?? []) })));
      setErr(null);
    } catch (e) {
      setErr(`Veri okunamadı: ${errMsg(e)} · Supabase şeması güncel mi? (supabase/schema.sql)`);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const kpi = useMemo(() => {
    const fees = rows.reduce((s, r) => s + r.d.totalFees, 0);
    const revisions = rows.reduce((s, r) => s + r.d.revisionCount, 0);
    const expiring = rows.reduce((s, r) => s + r.d.expiringCount, 0);
    const worst = rows.reduce((s, r) => Math.max(s, r.d.worstWaitDays), 0);
    const expiringRows = rows.filter((r) => r.d.expiringCount > 0);
    return { fees, revisions, expiring, worst, expiringRows };
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const filtered = rows.filter(({ project, d }) => {
      if (onlyRisky && !d.revisionCount && !d.expiringCount && d.worstWaitDays < 21) return false;
      if (!needle) return true;
      return [project.name, project.municipality, project.ada, project.parsel, project.pafta]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(needle);
    });
    return sortRows(filtered, sortKey);
  }, [rows, q, onlyRisky, sortKey]);

  // "/" tuşu — arama kutusuna odaklan (girdi içindeyken yakalama)
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === "/" && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Kısa toast bildirim — silme/kopyalama gibi işlemlerde
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" dosyası ve tüm evrakları silinsin mi?`)) return;
    try {
      await deletePermitProject(id);
      await load();
      setToast(`"${name}" silindi`);
    } catch (e) {
      setErr(`Silinemedi: ${errMsg(e)}`);
    }
  };

  const onCopy = async (id: string, name: string) => {
    const newName = window.prompt(`"${name}" dosyasının kopyası — yeni proje adı:`, `${name} — Kopya`);
    if (!newName?.trim()) return;
    try {
      await copyPermitProject(id, newName.trim());
      await load();
      setToast(`"${newName.trim()}" oluşturuldu`);
    } catch (e) {
      setErr(`Kopyalanamadı: ${errMsg(e)}`);
    }
  };

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await createPermitProject({
        name: String(f.get("name")),
        municipality: String(f.get("municipality")),
        ada: String(f.get("ada") ?? ""),
        pafta: String(f.get("pafta") ?? ""),
        parsel: String(f.get("parsel") ?? ""),
        current_stage: 1,
        note: "",
        area_m2: f.get("area_m2") ? Number(f.get("area_m2")) : null,
        usage: (String(f.get("usage") ?? "konut") === "isyeri" ? "isyeri" : "konut") as PermitProject["usage"],
        unit_count: f.get("unit_count") ? Number(f.get("unit_count")) : null,
        parcel_m2: f.get("parcel_m2") ? Number(f.get("parcel_m2")) : null,
      });
      setOpen(false);
      await load();
    } catch (e) {
      setErr(`Proje oluşturulamadı: ${errMsg(e)}`);
    }
    setBusy(false);
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-hivis">
            Duran İnşaat · Süreç Takibi
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">
            Belediye Onay & Ruhsat Panosu
          </h1>
          <p className="mt-2 text-sm text-dim">
            Tüm projelerin evre durumu, bekleme süreleri ve harç toplamları tek ekranda.
            {PERMIT_DEMO && " (Demo modu — veriler bu tarayıcıda saklanır.)"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-sm bg-hivis px-5 py-2.5 text-sm font-semibold text-hivis-ink transition-colors hover:brightness-110"
          >
            {open ? "Vazgeç" : "+ Yeni Ruhsat Dosyası"}
          </button>
        </div>
      </header>

      {err && <p className="mt-6 text-sm font-semibold text-[#ff8f8f]">{err}</p>}

      {open && (
        <form
          onSubmit={onCreate}
          className="mt-8 grid gap-4 rounded-sm border border-line bg-surface p-5 md:grid-cols-5"
        >
          <div className="md:col-span-2">
            <ManualField label="Proje adı">
              <input name="name" required placeholder="Vadi Panorama Evleri" className={inputCls} />
            </ManualField>
          </div>
          <ManualField label="Belediye">
            <select name="municipality" className={inputCls} defaultValue={MUNICIPALITIES[0].name}>
              {MUNICIPALITIES.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </ManualField>
          <ManualField label="Ada">
            <input name="ada" className={inputCls} />
          </ManualField>
          <div className="grid grid-cols-2 gap-3">
            <ManualField label="Pafta">
              <input name="pafta" className={inputCls} />
            </ManualField>
            <ManualField label="Parsel">
              <input name="parsel" className={inputCls} />
            </ManualField>
          </div>
          <ManualField label="İnşaat alanı (m²)" hint="harç hesabı">
            <input name="area_m2" type="number" min="0" placeholder="4800" className={inputCls} />
          </ManualField>
          <ManualField label="Kullanım">
            <select name="usage" className={inputCls} defaultValue="konut">
              <option value="konut">Konut</option>
              <option value="isyeri">İşyeri</option>
            </select>
          </ManualField>
          <ManualField label="Bağımsız bölüm">
            <input name="unit_count" type="number" min="0" placeholder="36" className={inputCls} />
          </ManualField>
          <ManualField label="Parsel alanı (m²)">
            <input name="parcel_m2" type="number" min="0" placeholder="1200" className={inputCls} />
          </ManualField>
          <div className="md:col-span-5">
            <button
              type="submit"
              disabled={busy}
              className="rounded-sm bg-hivis px-6 py-2.5 text-sm font-semibold text-hivis-ink disabled:bg-line disabled:text-faint"
            >
              {busy ? "Oluşturuluyor…" : "Oluştur — 25 evrak kalemi otomatik açılır"}
            </button>
          </div>
        </form>
      )}

      {/* KPI şeridi — tamamı otomatik hesaplanır */}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Aktif dosya" value={String(rows.length)} />
        <Kpi label="Toplam belediye harcı" value={money(kpi.fees)} />
        <Kpi label="Revizyon bekleyen evrak" value={String(kpi.revisions)} tone={kpi.revisions ? "red" : "gray"} />
        <Kpi label="En uzun bekleyen" value={`${kpi.worst} gün`} tone={kpi.worst >= 21 ? "amber" : "gray"} />
      </div>
      {kpi.expiring > 0 && (
        <div className="mt-3 rounded-sm border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-4 py-3 text-sm text-[#ff8f8f]">
          <p className="font-semibold">
            {kpi.expiring} belgenin geçerlilik süresi 30 günden az — yenileme gerekiyor.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {kpi.expiringRows.map(({ project, d }) => (
              <li key={project.id}>
                <Link to={`/surec/${project.id}`} className="underline underline-offset-2 hover:text-ink">
                  {project.name}
                </Link>
                <span className="text-[#ff8f8f]/70"> · {d.expiringCount} belge</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…  ( / ile odakla)"
            className={`${inputCls} max-w-xs`}
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={`${inputCls} max-w-[200px]`}
            aria-label="Sırala"
            title="Sırala"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                Sırala · {SORT_LABEL[k]}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-dim">
            <input
              type="checkbox"
              checked={onlyRisky}
              onChange={(e) => setOnlyRisky(e.target.checked)}
              className="h-4 w-4 accent-[#d9b25c]"
            />
            Sadece riskli dosyalar (revizyon / 21+ gün / süresi dolan)
          </label>
          <span className="ml-auto font-mono text-xs text-faint">
            {visible.length}/{rows.length} dosya
          </span>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-dim">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-sm border border-dashed border-line p-10 text-center">
          <p className="text-dim">Henüz ruhsat dosyası yok.</p>
          <p className="mt-1 text-sm text-faint">
            Sağ üstteki "+ Yeni Ruhsat Dosyası" ile ilk dosyanı açabilirsin.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-dim">Aramaya uyan dosya yok.</p>
      ) : (
        <>
          {/* Masaüstü: tablo */}
          <div className="mt-8 hidden max-h-[70vh] overflow-auto rounded-sm border border-line lg:block">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface font-mono text-[11px] uppercase tracking-wide text-faint shadow-[0_1px_0_0_var(--color-line)]">
                <tr>
                  <th className="px-4 py-3">Proje</th>
                  <th className="px-4 py-3">Belediye</th>
                  <th className="w-64 px-4 py-3">Evreler</th>
                  <th className="px-4 py-3">Aktif evre</th>
                  <th className="px-4 py-3">Bekleme</th>
                  <th className="px-4 py-3 text-right">Harç</th>
                  <th className="px-4 py-3">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ project, d }) => {
                  const riskColor =
                    d.revisionCount > 0
                      ? "border-l-4 border-l-[#ff6b6b]"
                      : d.expiringCount > 0 || d.worstWaitDays >= 21
                        ? "border-l-4 border-l-hivis"
                        : d.progress === 1
                          ? "border-l-4 border-l-[#3ddc84]"
                          : "border-l-4 border-l-transparent";
                  return (
                  <tr
                    key={project.id}
                    onClick={() => navigate(`/surec/${project.id}`)}
                    className={`cursor-pointer border-t border-line-soft align-top transition-colors hover:bg-raised/70 ${riskColor}`}
                  >
                    <td className="px-4 py-4">
                      <Link to={`/surec/${project.id}`} className="font-semibold text-ink hover:text-hivis">
                        {project.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-faint">
                        {project.ada || "—"}/{project.pafta || "—"}/{project.parsel || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-dim">{project.municipality}</td>
                    <td className="px-4 py-4">
                      <StageStepper stages={d.stages} compact />
                      <p className="mt-2 text-[11px] text-faint">%{Math.round(d.progress * 100)} tamamlandı</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge tone={d.revisionCount ? "red" : d.progress === 1 ? "green" : "amber"}>
                        Evre {d.activeStage}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-4">
                      {d.worstWaitDays > 0 ? (
                        <span className={d.worstWaitDays >= 21 ? "font-semibold text-[#ff8f8f]" : "text-dim"}>
                          {d.worstWaitDays} gün
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-dim">{money(d.totalFees)}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-dim">
                      {d.nextAction}
                      <div className="mt-2 flex gap-3 text-[11px] text-faint">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onCopy(project.id, project.name);
                          }}
                          className="hover:text-hivis"
                        >
                          Kopyala
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onDelete(project.id, project.name);
                          }}
                          className="hover:text-[#ff8f8f]"
                        >
                          Dosyayı sil
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobil: kart */}
          <div className="mt-8 grid gap-4 lg:hidden">
            {visible.map(({ project, d }) => (
              <div
                key={project.id}
                className="rounded-sm border border-line bg-surface p-5 transition-colors hover:border-hivis/50"
              >
                <Link to={`/surec/${project.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-ink">{project.name}</h2>
                      <p className="mt-0.5 text-xs text-faint">
                        {project.municipality} · {project.ada}/{project.pafta}/{project.parsel}
                      </p>
                    </div>
                    <StatusBadge tone={d.revisionCount ? "red" : d.progress === 1 ? "green" : "amber"}>
                      Evre {d.activeStage}
                    </StatusBadge>
                  </div>
                  <div className="mt-4">
                    <StageStepper stages={d.stages} compact />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-dim">
                    <span>%{Math.round(d.progress * 100)} tamam</span>
                    {d.worstWaitDays > 0 && <span>{d.worstWaitDays} gündür belediyede</span>}
                    <span>{money(d.totalFees)} harç</span>
                  </div>
                  <p className="mt-3 text-xs text-hivis">{d.nextAction}</p>
                </Link>
                <div className="mt-4 flex gap-4 border-t border-line-soft pt-3 text-[11px] text-faint">
                  <button type="button" onClick={() => void onCopy(project.id, project.name)} className="hover:text-hivis">
                    Kopyala
                  </button>
                  <button type="button" onClick={() => void onDelete(project.id, project.name)} className="hover:text-[#ff8f8f]">
                    Dosyayı sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-sm border border-hivis/60 bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-lg"
        >
          {toast}
        </div>
      )}
    </section>
  );
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

function Kpi({ label, value, tone = "gray" }: { label: string; value: string; tone?: "gray" | "red" | "amber" }) {
  const color = tone === "red" ? "text-[#ff8f8f]" : tone === "amber" ? "text-hivis" : "text-ink";
  return (
    <div className="rounded-sm border border-line bg-surface px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
