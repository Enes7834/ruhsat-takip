-- Duran İnşaat — Belediye Onay & Ruhsat Süreci modülü
-- Supabase Dashboard → SQL Editor'de bir kez çalıştırın.
--
-- NOT: Durum etiketi (Onaylandı/Revizyonda/Sunuldu) KOLON DEĞİLDİR.
-- İstemcide deriveTask() ile approved_at / revision_note / submitted_at
-- alanlarından türetilir. Tek doğruluk kaynağı bu üç manuel alandır.

create table if not exists public.permit_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  municipality text not null default '',
  ada text not null default '',
  pafta text not null default '',
  parsel text not null default '',
  current_stage smallint not null default 1 check (current_stage between 1 and 4),
  note text not null default '',
  -- Harç hesabının matrahı
  area_m2 numeric(10, 2),
  usage text not null default 'konut' check (usage in ('konut', 'isyeri')),
  unit_count int,
  parcel_m2 numeric(10, 2)
);

-- Belediye harç tarifesi: birim fiyatlar elle girilir, hesap otomatiktir.
-- Belediyelerin ortak bir tarife servisi olmadığı için canlı çekilemez.
create table if not exists public.permit_tariffs (
  municipality text not null,
  year int not null,
  source text not null default '',
  updated_at timestamptz not null default now(),
  "binaInsaatHarci" jsonb not null default '{}',
  "yapiKullanmaHarci" jsonb not null default '{}',
  "otoparkBedeli" numeric(12, 2) not null default 0,
  "imarDurumu" numeric(12, 2) not null default 0,
  "aplikasyon" numeric(12, 2) not null default 0,
  "kotKesit" numeric(12, 2) not null default 0,
  "zeminEtutM2" numeric(12, 2) not null default 0,
  "yapiDenetimOrani" numeric(6, 3) not null default 0,
  "yaklasikBirimMaliyet" numeric(12, 2) not null default 0,
  extras jsonb not null default '[]',
  primary key (municipality, year)
);

alter table public.permit_tariffs enable row level security;

-- Giriş ekranı kaldırıldığı için politikalar anon rolüne de açık.
drop policy if exists "permit_tariffs_auth_all" on public.permit_tariffs;
create policy "permit_tariffs_all"
  on public.permit_tariffs for all
  to anon, authenticated using (true) with check (true);

create table if not exists public.permit_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.permit_projects (id) on delete cascade,
  stage smallint not null check (stage between 1 and 4),
  title text not null,
  order_index int not null default 0,

  -- MANUEL alanlar
  tracking_no text,            -- belediye evrak/takip numarası
  assignee_name text,          -- sorumlu kişi
  assignee_role text,          -- Mimar / Statik / Mekanik / Elektrik ...
  submitted_at date,           -- belediyeye teslim tarihi (gün sayacının başlangıcı)
  approved_at date,            -- onay tarihi
  expires_at date,             -- belgenin geçerlilik bitişi (ör. imar durumu)
  revision_note text,          -- belediye revizyon / eksik notu
  fee_amount numeric(12, 2),   -- ödenen harç / gider
  file_url text,
  file_name text,
  updated_at timestamptz not null default now()
);

create index if not exists permit_tasks_project_idx on public.permit_tasks (project_id, order_index);

alter table public.permit_projects enable row level security;
alter table public.permit_tasks enable row level security;

-- Giriş ekranı kaldırıldı: anon rolüne de tam erişim veriyoruz.
drop policy if exists "permit_projects_auth_all" on public.permit_projects;
drop policy if exists "permit_tasks_auth_all" on public.permit_tasks;

create policy "permit_projects_all"
  on public.permit_projects for all
  to anon, authenticated using (true) with check (true);

create policy "permit_tasks_all"
  on public.permit_tasks for all
  to anon, authenticated using (true) with check (true);

-- Evrak/PDF deposu
insert into storage.buckets (id, name, public)
values ('ruhsat', 'ruhsat', true)
on conflict (id) do nothing;

drop policy if exists "ruhsat_auth_read" on storage.objects;
drop policy if exists "ruhsat_auth_upload" on storage.objects;

create policy "ruhsat_read"
  on storage.objects for select
  to anon, authenticated using (bucket_id = 'ruhsat');

create policy "ruhsat_upload"
  on storage.objects for insert
  to anon, authenticated with check (bucket_id = 'ruhsat');
