import { STAGES, deriveTask, todayISO, type PermitTask, type StageNo, type StageProgress } from "../../lib/permits";

const DOT: Record<string, string> = {
  gray: "bg-line",
  amber: "bg-hivis",
  red: "bg-[#ff6b6b]",
  green: "bg-[#3ddc84]",
};

const EDGE: Record<string, string> = {
  gray: "border-l-line",
  amber: "border-l-hivis",
  red: "border-l-[#ff6b6b]",
  green: "border-l-[#3ddc84]",
};

/**
 * 4 evre = 4 slot. Her slot kendi evrağını kart olarak taşır; kart üzerindeki
 * mini butonlarla durum tek tıkla ilerletilir (detay açmaya gerek yok).
 */
export default function PermitKanban({
  tasks,
  stages,
  onOpen,
  onPatch,
  onBulkSubmit,
  onBulkApprove,
  onBulkRevision,
}: {
  tasks: PermitTask[];
  stages: StageProgress[];
  onOpen: (taskId: string) => void;
  onPatch: (taskId: string, patch: Partial<PermitTask>) => void;
  onBulkSubmit?: (stage: StageNo) => void;
  onBulkApprove?: (stage: StageNo) => void;
  onBulkRevision?: (stage: StageNo) => void;
}) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-4">
      {STAGES.map((s) => {
        const prog = stages.find((x) => x.no === s.no)!;
        const list = tasks.filter((t) => t.stage === s.no).sort((a, b) => a.order_index - b.order_index);
        const headTone =
          prog.blocked > 0 ? "red" : prog.state === "tamam" ? "green" : prog.state === "devam" ? "amber" : "gray";
        return (
          <section
            key={s.no}
            className="w-[85vw] flex-none snap-start rounded-sm border border-line bg-surface/60 p-3 md:w-auto"
          >
            <header className="mb-3 border-b border-line-soft pb-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Evre {s.no}</p>
                <span className={`h-2 w-2 rounded-full ${DOT[headTone]}`} />
              </div>
              <h3 className="mt-1 text-sm font-bold text-ink">{s.title}</h3>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line-soft">
                <div className={`h-full ${DOT[headTone]}`} style={{ width: `${prog.ratio * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-faint">
                {prog.done}/{prog.total} onaylı{prog.blocked > 0 ? ` · ${prog.blocked} eksik` : ""}
              </p>
              {(onBulkSubmit || onBulkApprove || onBulkRevision) && (
                <div className="mt-2 flex gap-1.5">
                  {onBulkSubmit && <Mini label="Teslim" title="Tüm evrağı bugüne teslim yap" onClick={() => onBulkSubmit(s.no)} />}
                  {onBulkApprove && (
                    <Mini label="Onayla" title="Tüm evrağı bugüne onayla" tone="green" onClick={() => onBulkApprove(s.no)} />
                  )}
                  {onBulkRevision && (
                    <Mini label="Revizyon" title="Tüm evrağa ortak revizyon notu" tone="red" onClick={() => onBulkRevision(s.no)} />
                  )}
                </div>
              )}
            </header>

            <div className="space-y-2">
              {list.map((t) => {
                const d = deriveTask(t);
                return (
                  <article
                    key={t.id}
                    className={`rounded-sm border border-line border-l-2 bg-base p-3 ${EDGE[d.tone]}`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(t.id)}
                      className="block w-full text-left text-sm font-semibold text-ink hover:text-hivis"
                    >
                      {t.title}
                    </button>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      <span className={`inline-flex items-center gap-1 ${d.tone === "red" ? "text-[#ff8f8f]" : d.tone === "green" ? "text-[#5ae5a0]" : d.tone === "amber" ? "text-hivis" : "text-faint"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${DOT[d.tone]}`} />
                        {d.label}
                      </span>
                      {d.daysAtMunicipality !== null && (
                        <span className={d.daysAtMunicipality >= 21 ? "font-semibold text-[#ff8f8f]" : "text-faint"}>
                          {d.daysAtMunicipality} gün
                        </span>
                      )}
                      {d.expiryWarning && d.status !== "onaylandi" && (
                        <span className="text-[#ff8f8f]">
                          {d.expiryDays !== null && d.expiryDays < 0 ? "süresi doldu" : `${d.expiryDays} gün kaldı`}
                        </span>
                      )}
                    </div>

                    {t.assignee_name && (
                      <p className="mt-1 text-[11px] text-faint">
                        {t.assignee_name}
                        {t.assignee_role ? ` · ${t.assignee_role}` : ""}
                      </p>
                    )}
                    {t.revision_note && (
                      <p className="mt-1.5 line-clamp-2 rounded-sm bg-[#ff6b6b]/10 px-2 py-1 text-[11px] text-[#ff8f8f]">
                        {t.revision_note}
                      </p>
                    )}

                    {/* Kart üstü hızlı aksiyon */}
                    <div className="mt-2 flex gap-1.5">
                      {!t.submitted_at && (
                        <Mini label="Teslim" title="Bugün belediyeye teslim edildi" onClick={() => onPatch(t.id, { submitted_at: todayISO() })} />
                      )}
                      {!t.approved_at && (
                        <Mini
                          label="Onayla"
                          title="Bugün onaylandı"
                          tone="green"
                          onClick={() => onPatch(t.id, { approved_at: todayISO(), revision_note: null })}
                        />
                      )}
                      <Mini
                        label="Revizyon"
                        title="Belediye eksik/revizyon notu"
                        tone="red"
                        onClick={() => {
                          const note = window.prompt("Revizyon notu:", t.revision_note ?? "");
                          if (note !== null) onPatch(t.id, { revision_note: note || null, approved_at: null });
                        }}
                      />
                    </div>
                  </article>
                );
              })}
              {list.length === 0 && <p className="py-6 text-center text-xs text-faint">Evrak yok</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Mini({
  label,
  title,
  tone = "amber",
  onClick,
}: {
  label: string;
  title: string;
  tone?: "amber" | "green" | "red";
  onClick: () => void;
}) {
  const cls = {
    amber: "hover:border-hivis hover:text-hivis",
    green: "hover:border-[#3ddc84] hover:text-[#5ae5a0]",
    red: "hover:border-[#ff6b6b] hover:text-[#ff8f8f]",
  }[tone];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-sm border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-faint transition-colors ${cls}`}
    >
      {label}
    </button>
  );
}
