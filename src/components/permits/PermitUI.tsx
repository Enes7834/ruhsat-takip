import type { ReactNode } from "react";
import { STAGES, type StageProgress, type Tone } from "../../lib/permits";

/* Tone → sınıf eşlemesi. Tailwind v4 sınıfları statik olmak zorunda,
   bu yüzden tam sınıf adları burada sabit tutulur. */
const TONE: Record<Tone, string> = {
  gray: "border-line bg-line-soft/60 text-dim",
  amber: "border-hivis/40 bg-hivis/10 text-hivis",
  red: "border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ff8f8f]",
  green: "border-[#3ddc84]/40 bg-[#3ddc84]/10 text-[#5ae5a0]",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${TONE[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/** 4 evreli ilerleme çubuğu. Tıklanabilirse evre seçici olarak da çalışır. */
export function StageStepper({
  stages,
  active,
  onSelect,
  compact = false,
}: {
  stages: StageProgress[];
  active?: number;
  onSelect?: (no: 1 | 2 | 3 | 4) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-4 ${compact ? "gap-1.5" : "gap-2"}`}>
      {stages.map((s) => {
        const meta = STAGES.find((x) => x.no === s.no)!;
        const isActive = active === s.no;
        const bar =
          s.blocked > 0
            ? "bg-[#ff6b6b]"
            : s.state === "tamam"
              ? "bg-[#3ddc84]"
              : s.state === "devam"
                ? "bg-hivis"
                : "bg-line";
        const Tag = onSelect ? "button" : "div";
        return (
          <Tag
            key={s.no}
            {...(onSelect ? { type: "button" as const, onClick: () => onSelect(s.no) } : {})}
            className={`text-left transition-opacity ${onSelect ? "cursor-pointer hover:opacity-100" : ""} ${
              isActive || !onSelect ? "opacity-100" : "opacity-60"
            }`}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
              <div className={`h-full ${bar}`} style={{ width: `${Math.max(s.ratio * 100, s.state === "bekliyor" ? 0 : 8)}%` }} />
            </div>
            {!compact && (
              <div className="mt-2">
                <p className={`font-mono text-[10px] ${isActive ? "text-hivis" : "text-faint"}`}>
                  EVRE {s.no}
                </p>
                <p className="text-xs font-semibold text-ink">{meta.short}</p>
                <p className="text-[11px] text-faint">
                  {s.done}/{s.total} onaylı{s.blocked > 0 ? ` · ${s.blocked} eksik` : ""}
                </p>
              </div>
            )}
          </Tag>
        );
      })}
    </div>
  );
}

/** MANUEL alan sarmalayıcı — girdi alanları bu etiketle işaretlenir */
export function ManualField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-line">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** OTOMATİK alan — kullanıcı yazamaz, sistem hesaplar */
export function AutoStat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  const color =
    tone === "red"
      ? "text-[#ff8f8f]"
      : tone === "green"
        ? "text-[#5ae5a0]"
        : tone === "amber"
          ? "text-hivis"
          : "text-ink";
  return (
    <div className="rounded-sm border border-line-soft bg-base/60 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export const inputCls =
  "w-full rounded-sm border border-line bg-base px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-hivis";
