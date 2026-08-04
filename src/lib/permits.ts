import { supabase } from "./supabase";

/* ------------------------------------------------------------------ *
 * Belediye Onay & Ruhsat Süreci — veri modeli
 *
 * Alanlar iki gruba ayrılır:
 *   MANUEL  → kullanıcı/ekip girer (tablo kolonu olarak tutulur)
 *   OTOMATİK→ hiçbir zaman yazılmaz, deriveTask/deriveProject ile hesaplanır
 * Bu ayrım UI'da da korunur (PermitTaskPanel: "Girdi" / "Sistem" sütunları).
 * ------------------------------------------------------------------ */

export type StageNo = 1 | 2 | 3 | 4;
export type TaskStatus = "bekliyor" | "sunuldu" | "revizyon" | "onaylandi";

/** MANUEL alanlar — proje künyesi */
export type PermitProject = {
  id: string;
  created_at: string;
  name: string;
  municipality: string;
  ada: string;
  pafta: string;
  parsel: string;
  current_stage: StageNo;
  note: string;
  /** Toplam inşaat alanı — harç hesabının matrahı */
  area_m2: number | null;
  usage: "konut" | "isyeri";
  /** Bağımsız bölüm sayısı — otopark bedeli için */
  unit_count: number | null;
  /** Parsel alanı (m²) — imar durumu gibi parsele bağlı ücretler için */
  parcel_m2: number | null;
};

/** MANUEL alanlar — evrak/görev satırı */
export type PermitTask = {
  id: string;
  project_id: string;
  stage: StageNo;
  title: string;
  order_index: number;
  /** Belediye evrak/takip numarası */
  tracking_no: string | null;
  assignee_name: string | null;
  assignee_role: string | null;
  /** Belediyeye teslim tarihi — "X gündür belediyede" sayacının başlangıcı */
  submitted_at: string | null;
  approved_at: string | null;
  /** Belgenin geçerlilik bitişi (ör. imar durumu) */
  expires_at: string | null;
  revision_note: string | null;
  fee_amount: number | null;
  file_url: string | null;
  file_name: string | null;
};

/* --------------------------- Evre kataloğu --------------------------- */

export const STAGES: { no: StageNo; title: string; short: string; tasks: string[] }[] = [
  {
    no: 1,
    title: "Ruhsat Öncesi Hazırlık",
    short: "Hazırlık",
    tasks: [
      "İmar durum belgesi",
      "Aplikasyon krokisi",
      "Zemin etüt raporu",
      "Kot-kesit belgesi",
      "Tapu / çap belgesi",
      "Yol-kanal kotu tutanağı",
    ],
  },
  {
    no: 2,
    title: "Proje Onayları",
    short: "Proje Onayı",
    tasks: [
      "Mimari proje onayı",
      "Statik proje onayı",
      "Mekanik tesisat onayı",
      "Elektrik tesisat onayı",
      "Yangın tahliye projesi onayı",
      "Altyapı (İSKİ/doğalgaz) onayı",
      "Asansör avan projesi onayı",
    ],
  },
  {
    no: 3,
    title: "Yapı Ruhsatı Kesimi",
    short: "Ruhsat",
    tasks: [
      "Yapı denetim sözleşmesi",
      "Yapı denetim izin belgesi (YİBF)",
      "Harç ve otopark bedeli dekontları",
      "SGK işyeri bildirimi",
      "Şantiye şefi sözleşmesi",
      "Yapı ruhsatı belgesi",
    ],
  },
  {
    no: 4,
    title: "Şantiye & İskan Süreci",
    short: "Şantiye/İskan",
    tasks: [
      "Temel vizesi",
      "Su basman vizesi",
      "Kat vizeleri",
      "Çatı vizesi",
      "Yapı kullanma izni (iskan) başvurusu",
      "İskan belgesi",
    ],
  },
];

export const STAGE_BY_NO = new Map(STAGES.map((s) => [s.no, s]));

/* ----------------------- E-Belediye takip linki ----------------------- */

/**
 * Belediye → evrak sorgulama sayfası. `{no}` varsa takip numarası yerleştirilir,
 * yoksa link sorgulama sayfasını açar. Yeni belediye eklemek için buraya satır ekleyin.
 */
export const MUNICIPALITIES: { name: string; query: string }[] = [
  { name: "Sultangazi Belediyesi", query: "https://www.sultangazi.bel.tr/evrak-takip?no={no}" },
  { name: "Gaziosmanpaşa Belediyesi", query: "https://www.gaziosmanpasa.bel.tr/evrak-takip?no={no}" },
  { name: "Eyüpsultan Belediyesi", query: "https://www.eyupsultan.bel.tr/evrak-takip?no={no}" },
  { name: "Esenler Belediyesi", query: "https://www.esenler.bel.tr/evrak-takip?no={no}" },
  { name: "Bağcılar Belediyesi", query: "https://www.bagcilar.bel.tr/evrak-takip?no={no}" },
  { name: "Başakşehir Belediyesi", query: "https://www.basaksehir.bel.tr/evrak-takip?no={no}" },
  { name: "Arnavutköy Belediyesi", query: "https://www.arnavutkoy.bel.tr/evrak-takip?no={no}" },
  { name: "İBB (İmar/Altyapı)", query: "https://www.ibb.istanbul/evrak-takip?no={no}" },
  { name: "Diğer", query: "" },
];

export function eBelediyeUrl(municipality: string, trackingNo: string | null): string | null {
  const m = MUNICIPALITIES.find((x) => x.name === municipality);
  if (!m?.query) return null;
  if (!trackingNo) return m.query.split("?")[0];
  return m.query.replace("{no}", encodeURIComponent(trackingNo));
}

/* -------------------------- Otomatik hesaplar -------------------------- */

const DAY = 86_400_000;

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

export type Tone = "gray" | "amber" | "red" | "green";

export type TaskDerived = {
  status: TaskStatus;
  label: string;
  tone: Tone;
  /** "X gündür belediyede" — onaylanmamış ve teslim edilmiş evraklar için */
  daysAtMunicipality: number | null;
  /** Belgenin bitmesine kalan gün (negatif = süresi dolmuş) */
  expiryDays: number | null;
  expiryWarning: boolean;
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  bekliyor: "Hazırlanıyor",
  sunuldu: "Belediyeye Sunuldu",
  revizyon: "Revizyonda / Eksik Var",
  onaylandi: "Onaylandı",
};

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  bekliyor: "gray",
  sunuldu: "amber",
  revizyon: "red",
  onaylandi: "green",
};

/** Durum etiketi manuel seçilmez; girilen alanlardan türetilir. */
export function deriveTask(t: PermitTask, now = Date.now()): TaskDerived {
  const status: TaskStatus = t.approved_at
    ? "onaylandi"
    : t.revision_note?.trim()
      ? "revizyon"
      : t.submitted_at || t.file_url
        ? "sunuldu"
        : "bekliyor";

  const expiryDays = t.expires_at ? -(daysSince(t.expires_at, now) ?? 0) : null;

  return {
    status,
    label: STATUS_LABEL[status],
    tone: STATUS_TONE[status],
    daysAtMunicipality: status === "onaylandi" ? null : daysSince(t.submitted_at, now),
    expiryDays,
    expiryWarning: expiryDays !== null && expiryDays <= 30,
  };
}

export type StageProgress = {
  no: StageNo;
  total: number;
  done: number;
  ratio: number;
  blocked: number;
  state: "bekliyor" | "devam" | "tamam";
};

export type ProjectDerived = {
  stages: StageProgress[];
  /** Üzerinde çalışılan ilk tamamlanmamış evre */
  activeStage: StageNo;
  totalFees: number;
  /** En uzun süredir belediyede bekleyen evrak (gün) */
  worstWaitDays: number;
  worstWaitTitle: string | null;
  revisionCount: number;
  expiringCount: number;
  progress: number;
  /** Kritik aksiyon önerisi — bir sonraki adım tamamlandığında değişir */
  nextAction: string;
};

export function deriveProject(tasks: PermitTask[], now = Date.now()): ProjectDerived {
  const stages: StageProgress[] = STAGES.map((s) => {
    const list = tasks.filter((t) => t.stage === s.no);
    const done = list.filter((t) => !!t.approved_at).length;
    const blocked = list.filter((t) => deriveTask(t, now).status === "revizyon").length;
    const total = list.length;
    return {
      no: s.no,
      total,
      done,
      blocked,
      ratio: total ? done / total : 0,
      state: total && done === total ? "tamam" : done || blocked ? "devam" : "bekliyor",
    };
  });

  const activeStage = (stages.find((s) => s.state !== "tamam")?.no ?? 4) as StageNo;

  let worstWaitDays = 0;
  let worstWaitTitle: string | null = null;
  let revisionCount = 0;
  let expiringCount = 0;
  let totalFees = 0;

  for (const t of tasks) {
    const d = deriveTask(t, now);
    totalFees += t.fee_amount ?? 0;
    if (d.status === "revizyon") revisionCount++;
    if (d.expiryWarning && d.status !== "onaylandi") expiringCount++;
    if (d.daysAtMunicipality !== null && d.daysAtMunicipality > worstWaitDays) {
      worstWaitDays = d.daysAtMunicipality;
      worstWaitTitle = t.title;
    }
  }

  const done = tasks.filter((t) => !!t.approved_at).length;

  return {
    stages,
    activeStage,
    totalFees,
    worstWaitDays,
    worstWaitTitle,
    revisionCount,
    expiringCount,
    progress: tasks.length ? done / tasks.length : 0,
    nextAction: nextAction(tasks, stages, activeStage, now),
  };
}

function nextAction(
  tasks: PermitTask[],
  stages: StageProgress[],
  activeStage: StageNo,
  now: number,
): string {
  const rev = tasks.find((t) => deriveTask(t, now).status === "revizyon");
  if (rev) return `Revizyon bekliyor: "${rev.title}" eksiklerini tamamlayıp yeniden sunun.`;

  const expiring = tasks.find((t) => {
    const d = deriveTask(t, now);
    return d.expiryWarning && d.status !== "onaylandi";
  });
  if (expiring) {
    const d = deriveTask(expiring, now);
    return d.expiryDays !== null && d.expiryDays < 0
      ? `"${expiring.title}" süresi doldu — yenileyin.`
      : `"${expiring.title}" ${d.expiryDays} gün içinde doluyor — yenileme başvurusu yapın.`;
  }

  const stalled = tasks
    .map((t) => ({ t, d: deriveTask(t, now) }))
    .filter((x) => x.d.status === "sunuldu" && (x.d.daysAtMunicipality ?? 0) >= 21)
    .sort((a, b) => (b.d.daysAtMunicipality ?? 0) - (a.d.daysAtMunicipality ?? 0))[0];
  if (stalled)
    return `"${stalled.t.title}" ${stalled.d.daysAtMunicipality} gündür belediyede — takip edin.`;

  const waiting = tasks
    .filter((t) => t.stage === activeStage && deriveTask(t, now).status === "bekliyor")
    .sort((a, b) => a.order_index - b.order_index)[0];
  if (waiting) return `Sonraki adım: "${waiting.title}" başvurusunu yapın.`;

  const stage = stages.find((s) => s.no === activeStage);
  if (stage && stage.state !== "tamam") return `${STAGE_BY_NO.get(activeStage)?.title} evresinde onay bekleniyor.`;
  return "Tüm evreler tamamlandı — iskan süreci kapandı.";
}

/* ------------------------------- Biçim ------------------------------- */

const tryFmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export const money = (n: number) => tryFmt.format(n);
export const dateTR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR") : "—";

/** Bugünün tarihi — date input'larıyla aynı biçimde (YYYY-AA-GG) */
export const todayISO = () => new Date().toISOString().slice(0, 10);
const shiftISO = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

/* ------------------------------ Veri katmanı ------------------------------ *
 * Supabase varsa oradan, yoksa localStorage üzerinden çalışır (AdminPage deseni).
 * ------------------------------------------------------------------------- */

const DEMO_P = "duran_permit_projects";
const DEMO_T = "duran_permit_tasks";

const readLS = <T,>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
};
const writeLS = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

export const PERMIT_DEMO = !supabase;

export function buildTasks(projectId: string): PermitTask[] {
  return STAGES.flatMap((s, si) =>
    s.tasks.map((title, i) => ({
      id: crypto.randomUUID(),
      project_id: projectId,
      stage: s.no,
      title,
      order_index: si * 100 + i,
      tracking_no: null,
      assignee_name: null,
      assignee_role: null,
      submitted_at: null,
      approved_at: null,
      expires_at: null,
      revision_note: null,
      fee_amount: null,
      file_url: null,
      file_name: null,
    })),
  );
}

export async function listPermitProjects(): Promise<PermitProject[]> {
  if (!supabase) return readLS<PermitProject>(DEMO_P);
  const { data } = await supabase
    .from("permit_projects")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as PermitProject[]) ?? [];
}

export async function listPermitTasks(projectId?: string): Promise<PermitTask[]> {
  if (!supabase) {
    const all = readLS<PermitTask>(DEMO_T);
    return projectId ? all.filter((t) => t.project_id === projectId) : all;
  }
  let q = supabase.from("permit_tasks").select("*").order("order_index");
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  return (data as PermitTask[]) ?? [];
}

export async function createPermitProject(
  input: Omit<PermitProject, "id" | "created_at">,
): Promise<PermitProject> {
  if (!supabase) {
    const project: PermitProject = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    writeLS(DEMO_P, [project, ...readLS<PermitProject>(DEMO_P)]);
    writeLS(DEMO_T, [...readLS<PermitTask>(DEMO_T), ...buildTasks(project.id)]);
    return project;
  }
  const { data, error } = await supabase
    .from("permit_projects")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  const project = data as PermitProject;
  const { error: tErr } = await supabase.from("permit_tasks").insert(
    buildTasks(project.id).map(({ id: _id, ...rest }) => rest),
  );
  if (tErr) throw tErr;
  return project;
}

/** Boş ekranı doldurmak için gerçekçi bir örnek dosya üretir. */
export async function seedDemoProject(): Promise<PermitProject> {
  const p = await createPermitProject({
    name: "Örnek — Vadi Panorama Evleri",
    municipality: MUNICIPALITIES[0].name,
    ada: "1234",
    pafta: "F21c-08",
    parsel: "7",
    current_stage: 2,
    note: "",
    area_m2: 4800,
    usage: "konut",
    unit_count: 36,
    parcel_m2: 1200,
  });

  const patches: Record<string, Partial<PermitTask>> = {
    "İmar durum belgesi": {
      tracking_no: "2026/10241",
      assignee_name: "Ayşe Kaya",
      assignee_role: "Mimar",
      submitted_at: shiftISO(-140),
      approved_at: shiftISO(-128),
      expires_at: shiftISO(18),
    },
    "Aplikasyon krokisi": {
      assignee_name: "Murat Deniz",
      assignee_role: "Harita Mühendisi",
      submitted_at: shiftISO(-125),
      approved_at: shiftISO(-118),
    },
    "Zemin etüt raporu": {
      assignee_name: "Murat Deniz",
      assignee_role: "Harita Mühendisi",
      submitted_at: shiftISO(-115),
      approved_at: shiftISO(-96),
    },
    "Kot-kesit belgesi": { submitted_at: shiftISO(-110), approved_at: shiftISO(-104) },
    "Tapu / çap belgesi": { submitted_at: shiftISO(-140), approved_at: shiftISO(-139) },
    "Yol-kanal kotu tutanağı": { submitted_at: shiftISO(-100), approved_at: shiftISO(-88) },
    "Mimari proje onayı": {
      tracking_no: "2026/11876",
      assignee_name: "Ayşe Kaya",
      assignee_role: "Mimar",
      submitted_at: shiftISO(-52),
      revision_note: "Yangın merdiveni genişliği 1.20 m'ye çıkarılacak, otopark girişi revize edilecek.",
    },
    "Statik proje onayı": {
      tracking_no: "2026/11901",
      assignee_name: "Kemal Yıldız",
      assignee_role: "Statik Mühendisi",
      submitted_at: shiftISO(-34),
    },
    "Mekanik tesisat onayı": {
      assignee_name: "Selin Ateş",
      assignee_role: "Mekanik Mühendisi",
      submitted_at: shiftISO(-21),
    },
    "Elektrik tesisat onayı": {
      assignee_name: "Onur Bal",
      assignee_role: "Elektrik Mühendisi",
      submitted_at: shiftISO(-21),
      approved_at: shiftISO(-4),
    },
  };

  const tasks = await listPermitTasks(p.id);
  for (const t of tasks) {
    const patch = patches[t.title];
    if (patch) await updatePermitTask(t.id, patch);
  }
  return p;
}

export async function updatePermitProject(
  id: string,
  patch: Partial<PermitProject>,
): Promise<void> {
  if (!supabase) {
    writeLS(
      DEMO_P,
      readLS<PermitProject>(DEMO_P).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    return;
  }
  const { error } = await supabase.from("permit_projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePermitProject(id: string): Promise<void> {
  if (!supabase) {
    writeLS(DEMO_P, readLS<PermitProject>(DEMO_P).filter((p) => p.id !== id));
    writeLS(DEMO_T, readLS<PermitTask>(DEMO_T).filter((t) => t.project_id !== id));
    return;
  }
  const { error } = await supabase.from("permit_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePermitTask(
  id: string,
  patch: Partial<PermitTask>,
): Promise<void> {
  if (!supabase) {
    writeLS(
      DEMO_T,
      readLS<PermitTask>(DEMO_T).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    return;
  }
  const { error } = await supabase.from("permit_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

/** Ek evrak satırı — katalogda olmayan belgeler için */
export async function addPermitTask(
  projectId: string,
  stage: StageNo,
  title: string,
): Promise<PermitTask> {
  const base = buildTasks(projectId)[0];
  const task: PermitTask = { ...base, id: crypto.randomUUID(), stage, title, order_index: stage * 100 + 99 };
  if (!supabase) {
    writeLS(DEMO_T, [...readLS<PermitTask>(DEMO_T), task]);
    return task;
  }
  const { id: _id, ...rest } = task;
  const { data, error } = await supabase.from("permit_tasks").insert(rest).select().single();
  if (error) throw error;
  return data as PermitTask;
}

/** PDF/dosya yükleme — Supabase Storage "ruhsat" kovası; demoda yalnız dosya adı tutulur */
export async function uploadPermitFile(
  projectId: string,
  file: File,
): Promise<{ url: string | null; name: string }> {
  if (!supabase) return { url: null, name: file.name };
  const path = `${projectId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("ruhsat").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("ruhsat").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}
