import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AutoStat, ManualField, StageStepper, StatusBadge, inputCls } from "../components/permits/PermitUI";
import PermitKanban from "../components/permits/PermitKanban";
import TaskEditor from "../components/permits/TaskEditor";
import {
  MUNICIPALITIES,
  STAGES,
  addPermitTask,
  deletePermitProject,
  deletePermitTask,
  deriveProject,
  deriveTask,
  listPermitProjects,
  listPermitTasks,
  updatePermitProject,
  updatePermitTask,
  type PermitProject,
  type PermitTask,
  type StageNo,
} from "../lib/permits";

type View = "slot" | "liste";

export default function PermitDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<PermitProject | null>(null);
  const [tasks, setTasks] = useState<PermitTask[]>([]);
  const [view, setView] = useState<View>("slot");
  const [stage, setStage] = useState<StageNo>(1);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const [showSaved, setShowSaved] = useState(false);

  // Her kayıttan sonra kısa bir onay rozeti — alan otomatik kaydettiği için
  // kullanıcı "kaydettim mi?" diye tereddüt etmesin.
  useEffect(() => {
    if (!saveTick) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 1400);
    return () => clearTimeout(t);
  }, [saveTick]);

  // Esc → açık evrak penceresini kapat
  useEffect(() => {
    if (!openTask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenTask(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTask]);

  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [projects, list] = await Promise.all([listPermitProjects(), listPermitTasks(id)]);
        if (cancelled) return;
        const p = projects.find((x) => x.id === id) ?? null;
        setProject(p);
        setTasks(list);
        if (p) setStage(deriveProject(list).activeStage);
        setLoadErr(null);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const d = useMemo(() => deriveProject(tasks), [tasks]);
  const selected = tasks.find((t) => t.id === openTask) ?? null;

  const patchTask = (taskId: string, patch: Partial<PermitTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    void updatePermitTask(taskId, patch);
    setSaveTick((n) => n + 1);
  };

  const removeTask = async (taskId: string) => {
    try {
      await deletePermitTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (openTask === taskId) setOpenTask(null);
    } catch (e) {
      window.alert(`Evrak silinemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const patchProject = (patch: Partial<PermitProject>) => {
    if (!project) return;
    setProject({ ...project, ...patch });
    void updatePermitProject(project.id, patch);
    setSaveTick((n) => n + 1);
  };

  if (loading) return <p className="mx-auto max-w-7xl px-5 py-20 text-dim">Yükleniyor…</p>;
  if (loadErr)
    return (
      <div className="mx-auto max-w-7xl px-5 py-20">
        <p className="text-sm font-semibold text-[#ff8f8f]">Dosya yüklenemedi: {loadErr}</p>
        <Link to="/surec" className="mt-4 inline-block text-hivis">← Panoya dön</Link>
      </div>
    );
  if (!project)
    return (
      <div className="mx-auto max-w-7xl px-5 py-20">
        <p className="text-dim">Dosya bulunamadı.</p>
        <Link to="/surec" className="mt-4 inline-block text-hivis">
          ← Panoya dön
        </Link>
      </div>
    );

  const stageTasks = tasks.filter((t) => t.stage === stage).sort((a, b) => a.order_index - b.order_index);

  const onDelete = async () => {
    if (!window.confirm(`"${project.name}" dosyası ve tüm evrakları silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      await deletePermitProject(project.id);
      navigate("/surec");
    } catch (e) {
      window.alert(`Silinemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <div className="flex items-center justify-between gap-3 no-print">
        <Link to="/surec" className="font-mono text-xs uppercase tracking-widest text-faint hover:text-hivis">
          ← Ruhsat Panosu
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-dim transition-colors hover:border-hivis hover:text-hivis"
          >
            PDF / Yazdır
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-faint transition-colors hover:border-[#ff6b6b] hover:text-[#ff8f8f]"
          >
            Dosyayı sil
          </button>
        </div>
      </div>

      {/* Künye — manuel alanlar, alandan çıkınca kaydeder */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <input
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
            onBlur={(e) => patchProject({ name: e.target.value })}
            className="w-full bg-transparent font-display text-3xl font-bold text-ink outline-none md:text-4xl"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ManualField label="Belediye">
              <select
                value={project.municipality}
                onChange={(e) => patchProject({ municipality: e.target.value })}
                className={inputCls}
              >
                {MUNICIPALITIES.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </ManualField>
            <ManualField label="Mevcut aşama" hint="beyan">
              <select
                value={project.current_stage}
                onChange={(e) => patchProject({ current_stage: Number(e.target.value) as StageNo })}
                className={inputCls}
              >
                {STAGES.map((s) => (
                  <option key={s.no} value={s.no}>
                    Evre {s.no} — {s.short}
                  </option>
                ))}
              </select>
            </ManualField>
            {(["ada", "pafta", "parsel"] as const).map((k) => (
              <ManualField key={k} label={k === "ada" ? "Ada" : k === "pafta" ? "Pafta" : "Parsel"}>
                <input
                  defaultValue={project[k]}
                  onBlur={(e) => patchProject({ [k]: e.target.value })}
                  className={inputCls}
                />
              </ManualField>
            ))}
          </div>
        </div>

        {/* Otomatik özet */}
        <aside className="space-y-3 rounded-sm border border-line bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Sistem Özeti · otomatik</p>
          <div className="grid grid-cols-2 gap-2">
            <AutoStat label="İlerleme" value={`%${Math.round(d.progress * 100)}`} />
            <AutoStat label="Aktif evre" value={`Evre ${d.activeStage}`} tone="amber" />
            <AutoStat
              label="En uzun bekleme"
              value={d.worstWaitDays ? `${d.worstWaitDays} gün` : "—"}
              tone={d.worstWaitDays >= 21 ? "red" : "gray"}
            />
            <AutoStat
              label="Revizyon"
              value={d.revisionCount ? String(d.revisionCount) : "—"}
              tone={d.revisionCount ? "red" : "gray"}
            />
          </div>
          <div className="rounded-sm border border-hivis/40 bg-hivis/10 px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-hivis">Kritik aksiyon</p>
            <p className="mt-1 text-sm text-ink">{d.nextAction}</p>
          </div>
        </aside>
      </div>

      {/* Evre şeridi */}
      <div className="mt-8 rounded-sm border border-line bg-surface p-5">
        <StageStepper
          stages={d.stages}
          active={view === "liste" ? stage : undefined}
          onSelect={view === "liste" ? setStage : undefined}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-sm border border-line p-0.5">
          {(["slot", "liste"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-sm px-4 py-1.5 text-xs font-semibold transition-colors ${
                view === v ? "bg-hivis text-hivis-ink" : "text-dim hover:text-ink"
              }`}
            >
              {v === "slot" ? "Slot Görünümü · 4 Evre" : "Liste"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={async () => {
            const title = window.prompt("Evrak adı:");
            if (!title) return;
            const t = await addPermitTask(project.id, view === "liste" ? stage : d.activeStage, title);
            setTasks((prev) => [...prev, t]);
          }}
          className="rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-dim hover:border-hivis hover:text-hivis"
        >
          + Evrak ekle
        </button>
      </div>

      <div className="mt-4">
        {view === "slot" ? (
          <PermitKanban tasks={tasks} stages={d.stages} onOpen={setOpenTask} onPatch={patchTask} />
        ) : (
          <>
            <h2 className="mb-3 font-display text-lg font-bold text-ink">
              Evre {stage} — {STAGES.find((s) => s.no === stage)!.title}
            </h2>
            <div className="space-y-2">
              {stageTasks.map((t) => {
                const td = deriveTask(t);
                return (
                  <div
                    key={t.id}
                    className={`rounded-sm border bg-surface ${openTask === t.id ? "border-hivis/50" : "border-line"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenTask(openTask === t.id ? null : t.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                    >
                      <span className="flex-1 text-sm font-semibold text-ink">{t.title}</span>
                      {td.daysAtMunicipality !== null && (
                        <span
                          className={`font-mono text-xs ${td.daysAtMunicipality >= 21 ? "text-[#ff8f8f]" : "text-faint"}`}
                        >
                          {td.daysAtMunicipality} gündür belediyede
                        </span>
                      )}
                      {t.assignee_name && <span className="text-xs text-faint">{t.assignee_name}</span>}
                      <StatusBadge tone={td.tone}>{td.label}</StatusBadge>
                    </button>
                    {openTask === t.id && (
                      <div className="border-t border-line-soft p-4">
                        <TaskEditor
                          task={t}
                          municipality={project.municipality}
                          onPatch={(p) => patchTask(t.id, p)}
                          onDelete={() => void removeTask(t.id)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Slot görünümünde kart tıklanınca açılan düzenleyici */}
      {view === "slot" && selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center md:p-6"
          onClick={() => setOpenTask(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-t-lg border border-line bg-surface p-5 md:rounded-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
                  Evre {selected.stage} — {STAGES.find((s) => s.no === selected.stage)!.short}
                </p>
                <h3 className="mt-1 font-display text-xl font-bold text-ink">{selected.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenTask(null)}
                className="rounded-sm border border-line px-3 py-1.5 text-xs text-dim hover:border-hivis hover:text-hivis"
              >
                Kapat ✕
              </button>
            </div>
            <TaskEditor
              task={selected}
              municipality={project.municipality}
              onPatch={(p) => patchTask(selected.id, p)}
              onDelete={() => void removeTask(selected.id)}
            />
            <p className="mt-4 text-center text-[11px] text-faint">
              Değişiklikler anında kaydedilir · kapatmak için <kbd className="rounded-sm border border-line px-1">Esc</kbd>
            </p>
          </div>
        </div>
      )}

      {/* Kayıt onayı */}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-[#3ddc84]/40 bg-[#3ddc84]/15 px-4 py-2 text-xs font-semibold text-[#5ae5a0] backdrop-blur transition-opacity duration-200 ${
          showSaved ? "opacity-100" : "opacity-0"
        }`}
      >
        ✓ Kaydedildi
      </div>
    </section>
  );
}
