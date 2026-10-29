-- GymLog schema. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Every table is protected by row level security: a signed-in user can only ever see and change their own rows.
--
-- Safe to run again at any time (after an app update, or if you are unsure it ran): it only creates what is
-- missing and never deletes data. New columns are added in the "Upgrades" section at the bottom.

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

-- API access ---------------------------------------------------------------
-- Newer Supabase projects can be created with "automatically expose new tables" switched off; grant explicitly
-- so the app can reach the tables either way. Row level security below still limits every user to their rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.exercises, public.workouts, public.workout_exercises, public.sessions, public.metrics
  to authenticated;

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
-- photos are resized JPEGs on the phone; refuse anything else or anything huge
update storage.buckets
set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'gymlog';

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

-- Upgrades -----------------------------------------------------------------
-- When the app starts saving a new field, add it here as `add column if not exists`, so re-running this file
-- upgrades an existing project. (Until it is run, the app keeps such changes queued on the phone and shows
-- "The database needs an update".) Example:
--   alter table public.exercises add column if not exists equipment text not null default '';
alter table public.exercises add column if not exists equipment text not null default '';
alter table public.exercises add column if not exists tracking text not null default 'weight_reps';
alter table public.workouts add column if not exists folder text not null default '';
alter table public.metrics add column if not exists measures jsonb;
alter table public.workouts add column if not exists days smallint[] not null default '{}';

-- Ask the API to reload its schema cache right away, so new columns work without waiting.
notify pgrst, 'reload schema';

-- Delete account ------------------------------------------------------------
-- Settings -> Account -> Delete account calls this. It removes everything the signed-in user owns: their rows in
-- every GymLog table, their photos in the 'gymlog' bucket (folder = their user id) and finally the sign-in itself.
-- The app removes the photo files through the Storage API first; deleting the storage rows here is the backstop.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- children first, then parents
  delete from public.workout_exercises where user_id = me;
  delete from public.sessions where user_id = me;
  delete from public.metrics where user_id = me;
  delete from public.workouts where user_id = me;
  delete from public.exercises where user_id = me;

  -- newer projects block plain SQL deletes on storage.objects unless this is set for the transaction
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'gymlog' and (storage.foldername(name))[1] = me::text;

  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';

-- Shared exercise library ---------------------------------------------------------------------------------------
-- An exercise someone creates is suggested for everyone's library. It shows for all users only after an admin
-- approves it (Settings -> Suggested exercises, visible to admins only). Admins are the user ids in
-- exercise_admins; add one by hand in the SQL editor:
--   insert into public.exercise_admins (user_id) select id from auth.users where email = '<admin email>';
create table if not exists public.shared_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  muscle text not null check (char_length(muscle) <= 30),
  equipment text not null default '' check (char_length(equipment) <= 30),
  tracking text not null default 'weight_reps' check (tracking in ('weight_reps', 'reps', 'time')),
  -- id of a built-in library entry whose photo it shows (own photos stay private)
  photo text check (photo is null or char_length(photo) <= 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
-- one live entry per name (a rejected name may be suggested again)
create unique index if not exists shared_exercises_name on public.shared_exercises (lower(name)) where status <> 'rejected';

create table if not exists public.exercise_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.exercise_admins enable row level security; -- no policies: only the SQL editor sees it

create or replace function public.is_exercise_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.exercise_admins where user_id = auth.uid())
$$;
revoke all on function public.is_exercise_admin() from public;
revoke all on function public.is_exercise_admin() from anon;
grant execute on function public.is_exercise_admin() to authenticated;

alter table public.shared_exercises enable row level security;
drop policy if exists "read approved, own or as admin" on public.shared_exercises;
create policy "read approved, own or as admin" on public.shared_exercises for select to authenticated
  using (status = 'approved' or created_by = auth.uid() or public.is_exercise_admin());
drop policy if exists "suggest as yourself" on public.shared_exercises;
create policy "suggest as yourself" on public.shared_exercises for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending' and reviewed_at is null);
drop policy if exists "admins review" on public.shared_exercises;
create policy "admins review" on public.shared_exercises for update to authenticated
  using (public.is_exercise_admin()) with check (public.is_exercise_admin());
drop policy if exists "admins delete" on public.shared_exercises;
create policy "admins delete" on public.shared_exercises for delete to authenticated
  using (public.is_exercise_admin());

notify pgrst, 'reload schema';
