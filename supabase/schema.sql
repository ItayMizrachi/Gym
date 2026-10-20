-- GymLog schema. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Every table is protected by row level security: a signed-in user can only ever see and change their own rows.

create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  muscle text not null default 'Other',
  notes text not null default '',
  setup text not null default '',
  image_path text,
  rest_sec integer not null default 90,
  created_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  notes text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position integer not null default 0,
  sets integer not null default 3,
  rep_min integer not null default 8,
  rep_max integer not null default 12,
  weight numeric not null default 0,
  rest_sec integer not null default 90,
  superset text not null default '',
  drop_last boolean not null default false,
  note text not null default ''
);

-- A session stores its exercises and sets as JSON. It deliberately has no foreign key to workouts or
-- exercises, so deleting a template never deletes your history.
create table if not exists public.sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid,
  name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text not null default '',
  data jsonb not null default '{"exercises": []}'::jsonb
);

create table if not exists public.metrics (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric,
  note text not null default '',
  photo_path text,
  created_at timestamptz not null default now()
);

create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index if not exists metrics_user_date_idx on public.metrics (user_id, date desc);

-- Row level security -------------------------------------------------------
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.metrics enable row level security;

do $$
declare t text;
begin
  foreach t in array array['exercises', 'workouts', 'workout_exercises', 'sessions', 'metrics'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- Photo storage (private bucket, one folder per user) ----------------------
insert into storage.buckets (id, name, public)
values ('gymlog', 'gymlog', false)
on conflict (id) do nothing;

drop policy if exists "gymlog own files read" on storage.objects;
drop policy if exists "gymlog own files insert" on storage.objects;
drop policy if exists "gymlog own files update" on storage.objects;
drop policy if exists "gymlog own files delete" on storage.objects;

create policy "gymlog own files read" on storage.objects for select to authenticated
  using (bucket_id = 'gymlog' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gymlog own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'gymlog' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gymlog own files update" on storage.objects for update to authenticated
  using (bucket_id = 'gymlog' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gymlog own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'gymlog' and (storage.foldername(name))[1] = auth.uid()::text);
