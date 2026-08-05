import { useEffect, useMemo, useRef, useState } from "react";
import { inputCls } from "../components/permits/PermitUI";
import { createNote, deleteNote, listNotes, updateNote, type Note } from "../lib/notes";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listNotes();
      setNotes(list);
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
      setErr(null);
    } catch (e) {
      setErr(errMsg(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return notes;
    return notes.filter((n) =>
      (n.title + " " + n.body).toLocaleLowerCase("tr").includes(needle),
    );
  }, [notes, q]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const patchActive = (patch: Partial<Pick<Note, "title" | "body">>) => {
    if (!active) return;
    const now = new Date().toISOString();
    setNotes((prev) => prev.map((n) => (n.id === active.id ? { ...n, ...patch, updated_at: now } : n)));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateNote(active.id, patch);
        setSavedTick((n) => n + 1);
      } catch (e) {
        setErr(`Kaydedilemedi: ${errMsg(e)}`);
      }
    }, 500);
  };

  const onNew = async () => {
    try {
      const n = await createNote();
      setNotes((prev) => [n, ...prev]);
      setActiveId(n.id);
    } catch (e) {
      setErr(`Not oluşturulamadı: ${errMsg(e)}`);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Bu not silinsin mi?")) return;
    try {
      await deleteNote(id);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    } catch (e) {
      setErr(`Silinemedi: ${errMsg(e)}`);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-hivis">Duran İnşaat · Not Defteri</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">Notlarım</h1>
          <p className="mt-2 text-sm text-dim">
            Belediye konuşmaları, hatırlatmalar, kısa dökümler. Otomatik kaydedilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onNew()}
          className="rounded-sm bg-hivis px-5 py-2.5 text-sm font-semibold text-hivis-ink transition-colors hover:brightness-110"
        >
          + Yeni Not
        </button>
      </header>

      {err && <p className="mt-6 text-sm font-semibold text-[#ff8f8f]">{err}</p>}

      {loading ? (
        <p className="mt-10 text-dim">Yükleniyor…</p>
      ) : notes.length === 0 ? (
        <div className="mt-10 rounded-sm border border-dashed border-line p-10 text-center">
          <p className="text-dim">Henüz not yok.</p>
          <p className="mt-1 text-sm text-faint">"+ Yeni Not" ile başla.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Liste */}
          <aside className="rounded-sm border border-line bg-surface">
            <div className="border-b border-line-soft p-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Notlarda ara…"
                className={inputCls}
              />
            </div>
            <ul className="max-h-[65vh] overflow-y-auto">
              {filtered.map((n) => {
                const isActive = n.id === activeId;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(n.id)}
                      className={`w-full border-b border-line-soft px-3 py-3 text-left transition-colors hover:bg-raised/60 ${
                        isActive ? "bg-raised" : ""
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-ink">
                        {n.title.trim() || "Başlıksız"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-faint">
                        {n.body.trim().slice(0, 80) || "Boş not"}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-faint">
                        {new Date(n.updated_at).toLocaleDateString("tr-TR")}
                      </p>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="p-4 text-sm text-faint">Aramaya uyan not yok.</li>
              )}
            </ul>
          </aside>

          {/* Editör */}
          <div className="rounded-sm border border-line bg-surface p-5">
            {active ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    value={active.title}
                    onChange={(e) => patchActive({ title: e.target.value })}
                    placeholder="Başlık"
                    className="w-full flex-1 border-none bg-transparent font-display text-2xl font-bold text-ink outline-none"
                  />
                  <div className="flex items-center gap-3 text-xs text-faint">
                    <SavedIndicator tick={savedTick} />
                    <button
                      type="button"
                      onClick={() => void onDelete(active.id)}
                      className="hover:text-[#ff8f8f]"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                <textarea
                  value={active.body}
                  onChange={(e) => patchActive({ body: e.target.value })}
                  placeholder="Not gövdesi — belediye ile konuşmalar, hatırlatmalar…"
                  rows={20}
                  className="mt-4 w-full resize-y rounded-sm border border-line bg-base p-3 text-sm text-ink outline-none placeholder:text-faint focus:border-hivis"
                />
                <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-faint">
                  Son güncelleme · {new Date(active.updated_at).toLocaleString("tr-TR")}
                </p>
              </>
            ) : (
              <p className="text-dim">Bir not seç veya yeni not oluştur.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SavedIndicator({ tick }: { tick: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!tick) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, [tick]);
  return <span className={show ? "text-[#5ae5a0]" : "text-faint"}>{show ? "Kaydedildi ✓" : "Otomatik kaydedilir"}</span>;
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
