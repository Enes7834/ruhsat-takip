import { useState } from "react";
import { AutoStat, ManualField, StatusBadge, inputCls } from "./PermitUI";
import {
  dateTR,
  deriveTask,
  eBelediyeUrl,
  todayISO,
  uploadPermitFile,
  type PermitTask,
} from "../../lib/permits";

const ROLES = [
  "Mimar",
  "Statik Mühendisi",
  "Mekanik Mühendisi",
  "Elektrik Mühendisi",
  "Şantiye Şefi",
  "Yapı Denetim",
  "Harita Mühendisi",
  "Takipçi",
];

/** Tek evrağın tüm düzenleme yüzeyi: hızlı aksiyonlar + manuel giriş + sistem paneli */
export default function TaskEditor({
  task,
  municipality,
  onPatch,
  onDelete,
}: {
  task: PermitTask;
  municipality: string;
  onPatch: (patch: Partial<PermitTask>) => void;
  onDelete?: () => void;
}) {
  const d = deriveTask(task);
  const [uploading, setUploading] = useState(false);
  const link = eBelediyeUrl(municipality, task.tracking_no);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        {/* Hızlı aksiyonlar — form doldurmadan tek tıkla durum ilerletme */}
        <div className="mb-4 flex flex-wrap gap-2">
          <QuickBtn
            label="Bugün teslim ettim"
            tone="amber"
            active={!!task.submitted_at}
            onClick={() => onPatch({ submitted_at: todayISO() })}
          />
          <QuickBtn
            label="Onaylandı"
            tone="green"
            active={!!task.approved_at}
            onClick={() => onPatch({ approved_at: todayISO(), revision_note: null })}
          />
          <QuickBtn
            label="Revizyon geldi"
            tone="red"
            active={!!task.revision_note}
            onClick={() => {
              const note = window.prompt("Belediyenin eksik/revizyon notu:", task.revision_note ?? "");
              if (note !== null) onPatch({ revision_note: note || null, approved_at: null });
            }}
          />
          {(task.submitted_at || task.approved_at || task.revision_note) && (
            <QuickBtn
              label="Sıfırla"
              tone="gray"
              onClick={() => onPatch({ submitted_at: null, approved_at: null, revision_note: null })}
            />
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`"${task.title}" evrağı silinsin mi?`)) onDelete();
              }}
              className="ml-auto rounded-sm border border-line px-3 py-1.5 text-xs font-semibold text-faint transition-colors hover:border-[#ff6b6b] hover:text-[#ff8f8f]"
            >
              Evrağı sil
            </button>
          )}
        </div>

        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-faint">Manuel Giriş</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ManualField label="Belediye evrak / takip no">
            <input
              key={`t-${task.id}`}
              defaultValue={task.tracking_no ?? ""}
              onBlur={(e) => onPatch({ tracking_no: e.target.value || null })}
              placeholder="2026/123456"
              className={inputCls}
            />
          </ManualField>
          <ManualField label="Sorumlu kişi">
            <input
              key={`a-${task.id}`}
              defaultValue={task.assignee_name ?? ""}
              onBlur={(e) => onPatch({ assignee_name: e.target.value || null })}
              placeholder="Ad Soyad"
              className={inputCls}
            />
          </ManualField>
          <ManualField label="Görev / unvan">
            <select
              value={task.assignee_role ?? ""}
              onChange={(e) => onPatch({ assignee_role: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Seçiniz</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </ManualField>
          <ManualField label="Belediyeye teslim" hint="sayaç başlar">
            <input
              type="date"
              value={task.submitted_at ?? ""}
              onChange={(e) => onPatch({ submitted_at: e.target.value || null })}
              className={inputCls}
            />
          </ManualField>
          <ManualField label="Onay tarihi" hint="yeşile döner">
            <input
              type="date"
              value={task.approved_at ?? ""}
              onChange={(e) => onPatch({ approved_at: e.target.value || null })}
              className={inputCls}
            />
          </ManualField>
          <ManualField label="Geçerlilik bitişi" hint="30 gün kala uyarır">
            <input
              type="date"
              value={task.expires_at ?? ""}
              onChange={(e) => onPatch({ expires_at: e.target.value || null })}
              className={inputCls}
            />
          </ManualField>
          <ManualField label="Dosya / PDF">
            <input
              type="file"
              accept=".pdf,.dwg,.jpg,.png"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const { url, name } = await uploadPermitFile(task.project_id, file);
                  onPatch({ file_url: url, file_name: name });
                } finally {
                  setUploading(false);
                }
              }}
              className="w-full text-xs text-dim file:mr-3 file:rounded-sm file:border-0 file:bg-line file:px-3 file:py-2 file:text-xs file:text-ink"
            />
          </ManualField>
          <div className="sm:col-span-2">
            <ManualField label="Belediye revizyon / eksik notu" hint="doluysa kırmızıya döner">
              <textarea
                key={`r-${task.id}`}
                rows={2}
                defaultValue={task.revision_note ?? ""}
                onBlur={(e) => onPatch({ revision_note: e.target.value || null })}
                placeholder="Ör. Yangın merdiveni genişliği revize edilecek."
                className={inputCls}
              />
            </ManualField>
          </div>
        </div>
      </div>

      {/* Sistem paneli — yazılamaz, hesaplanır */}
      <div className="space-y-2">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-faint">Sistem · otomatik</p>
        <div>
          <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
        </div>
        <AutoStat
          label="Belediyede geçen süre"
          value={d.daysAtMunicipality !== null ? `${d.daysAtMunicipality} gün` : "—"}
          tone={(d.daysAtMunicipality ?? 0) >= 21 ? "red" : "gray"}
        />
        <AutoStat
          label="Geçerlilik"
          value={d.expiryDays === null ? "—" : d.expiryDays < 0 ? "Süresi doldu" : `${d.expiryDays} gün kaldı`}
          tone={d.expiryWarning ? "red" : "gray"}
        />
        <AutoStat label="Onay tarihi" value={dateTR(task.approved_at)} tone={task.approved_at ? "green" : "gray"} />
        {task.file_url ? (
          <a
            href={task.file_url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-sm border border-line-soft px-3 py-2 text-xs text-hivis hover:border-hivis"
          >
            📎 {task.file_name}
          </a>
        ) : (
          task.file_name && <p className="px-3 text-xs text-faint">📎 {task.file_name} (demo)</p>
        )}
        {link && (
          <div className="space-y-1.5">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="block rounded-sm bg-hivis px-3 py-2 text-center text-xs font-semibold text-hivis-ink hover:brightness-110"
            >
              Belediye sitesi →
            </a>
            {task.tracking_no && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(task.tracking_no!);
                  } catch {
                    // Bazı tarayıcılarda clipboard API kısıtlı — yok say
                  }
                }}
                className="w-full rounded-sm border border-line px-3 py-1.5 text-center text-[11px] font-semibold text-dim hover:border-hivis hover:text-hivis"
                title="Takip numarasını panoya kopyala"
              >
                Takip no kopyala · {task.tracking_no}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickBtn({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: "amber" | "green" | "red" | "gray";
  active?: boolean;
  onClick: () => void;
}) {
  const base = "rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors";
  const cls = {
    amber: active ? "border-hivis bg-hivis/15 text-hivis" : "border-line text-dim hover:border-hivis hover:text-hivis",
    green: active
      ? "border-[#3ddc84] bg-[#3ddc84]/15 text-[#5ae5a0]"
      : "border-line text-dim hover:border-[#3ddc84] hover:text-[#5ae5a0]",
    red: active
      ? "border-[#ff6b6b] bg-[#ff6b6b]/15 text-[#ff8f8f]"
      : "border-line text-dim hover:border-[#ff6b6b] hover:text-[#ff8f8f]",
    gray: "border-line text-faint hover:text-dim",
  }[tone];
  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      {label}
    </button>
  );
}
