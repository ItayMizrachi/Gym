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
-- a weight goal for the exercise: { weight, reps, by?, created } (src/lib/goals.ts)
alter table public.exercises add column if not exists goal jsonb;
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

  -- trainees this person coached without the app (placeholder accounts) go too, with their training
  delete from auth.users
   where id in (select trainee_id from public.coach_links where coach_id = me and managed)
     and raw_app_meta_data ->> 'provider' = 'managed';

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
grant select, insert, update, delete on public.shared_exercises to authenticated;
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

-- Coaching ------------------------------------------------------------------------------------------------------
-- A coach invites a trainee with a short code (Coach screen -> Add trainee). The trainee enters it under
-- Settings -> My coach; from then on the coach can read the trainee's training and add workouts to their plan.
-- Either side can end it at any time. Free for now; a paid tier can later gate creating invites.
create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trainee_id uuid references auth.users (id) on delete cascade,
  -- the coach's own label for the trainee
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  status text not null default 'invited' check (status in ('invited', 'active', 'ended')),
  trainee_email text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists coach_links_coach on public.coach_links (coach_id);
create index if not exists coach_links_trainee on public.coach_links (trainee_id);

alter table public.coach_links enable row level security;
grant select, insert, update, delete on public.coach_links to authenticated;
drop policy if exists "coach or trainee reads" on public.coach_links;
create policy "coach or trainee reads" on public.coach_links for select to authenticated
  using (coach_id = auth.uid() or trainee_id = auth.uid());
drop policy if exists "coach invites" on public.coach_links;
create policy "coach invites" on public.coach_links for insert to authenticated
  with check (coach_id = auth.uid() and trainee_id is null and status = 'invited');
drop policy if exists "coach edits" on public.coach_links;
create policy "coach edits" on public.coach_links for update to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "trainee ends" on public.coach_links;
create policy "trainee ends" on public.coach_links for update to authenticated
  using (trainee_id = auth.uid()) with check (trainee_id = auth.uid() and status = 'ended');
drop policy if exists "coach deletes" on public.coach_links;
create policy "coach deletes" on public.coach_links for delete to authenticated
  using (coach_id = auth.uid());

-- the trainee accepts an invite by its code
create or replace function public.accept_coach_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  link uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.coach_links
     set trainee_id = me, status = 'active', accepted_at = now(),
         trainee_email = (select email from auth.users where id = me)
   where code = upper(trim(p_code)) and status = 'invited' and coach_id <> me
  returning id into link;
  if link is null then
    raise exception 'No invite with that code' using errcode = 'P0002';
  end if;
  return link;
end;
$$;
revoke all on function public.accept_coach_invite(text) from public;
revoke all on function public.accept_coach_invite(text) from anon;
grant execute on function public.accept_coach_invite(text) to authenticated;

-- the trainee's coaches, with the coach's email (auth.users is not readable directly)
create or replace function public.my_coaches()
returns table (id uuid, coach_email text, status text, accepted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, u.email::text, l.status, l.accepted_at
    from public.coach_links l join auth.users u on u.id = l.coach_id
   where l.trainee_id = auth.uid() and l.status = 'active'
$$;
revoke all on function public.my_coaches() from public;
revoke all on function public.my_coaches() from anon;
grant execute on function public.my_coaches() to authenticated;

create or replace function public.is_coach_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coach_links
     where coach_id = auth.uid() and trainee_id = p_user and status = 'active'
  )
$$;
revoke all on function public.is_coach_of(uuid) from public;
revoke all on function public.is_coach_of(uuid) from anon;
grant execute on function public.is_coach_of(uuid) to authenticated;

-- a coach reads all of an active trainee's training, and builds their plan (workouts, their exercises)
do $$
declare t text;
begin
  foreach t in array array['exercises', 'workouts', 'workout_exercises', 'sessions', 'metrics'] loop
    execute format('drop policy if exists "coach reads" on public.%I', t);
    execute format('create policy "coach reads" on public.%I for select to authenticated using (public.is_coach_of(user_id))', t);
  end loop;
  foreach t in array array['exercises', 'workouts', 'workout_exercises'] loop
    execute format('drop policy if exists "coach adds" on public.%I', t);
    execute format('create policy "coach adds" on public.%I for insert to authenticated with check (public.is_coach_of(user_id))', t);
    execute format('drop policy if exists "coach edits" on public.%I', t);
    execute format('create policy "coach edits" on public.%I for update to authenticated using (public.is_coach_of(user_id)) with check (public.is_coach_of(user_id))', t);
  end loop;
  foreach t in array array['workouts', 'workout_exercises'] loop
    execute format('drop policy if exists "coach removes" on public.%I', t);
    execute format('create policy "coach removes" on public.%I for delete to authenticated using (public.is_coach_of(user_id))', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Coach notes: a short note from the coach on one of the trainee's workouts (or on the trainee in general when
-- session_id is null). The trainee reads them on that workout's summary.
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trainee_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists coach_notes_trainee on public.coach_notes (trainee_id, created_at desc);
alter table public.coach_notes enable row level security;
grant select, insert, update, delete on public.coach_notes to authenticated;
drop policy if exists "coach or trainee reads notes" on public.coach_notes;
create policy "coach or trainee reads notes" on public.coach_notes for select to authenticated
  using (coach_id = auth.uid() or trainee_id = auth.uid());
drop policy if exists "coach writes notes" on public.coach_notes;
create policy "coach writes notes" on public.coach_notes for insert to authenticated
  with check (coach_id = auth.uid() and public.is_coach_of(trainee_id));
drop policy if exists "coach edits notes" on public.coach_notes;
create policy "coach edits notes" on public.coach_notes for update to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach deletes notes" on public.coach_notes;
create policy "coach deletes notes" on public.coach_notes for delete to authenticated
  using (coach_id = auth.uid());

notify pgrst, 'reload schema';

-- Guard on coach_links: only accept_coach_invite() (which runs as the owner) may set who the trainee is or make a
-- link active. Signed-in users may rename a link or end it, nothing else; so a coach can never point a link at
-- someone who did not enter the code, or re-open a link the trainee ended.
create or replace function public.coach_links_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.coach_id <> old.coach_id
       or new.trainee_id is distinct from old.trainee_id
       or new.code <> old.code
       or new.trainee_email is distinct from old.trainee_email
       or new.accepted_at is distinct from old.accepted_at
       or new.created_at <> old.created_at then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.status <> old.status and new.status <> 'ended' then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists coach_links_guard on public.coach_links;
create trigger coach_links_guard before update on public.coach_links for each row execute function public.coach_links_guard();

-- a coach's note can only be moved to (or stay with) one of their own trainees
drop policy if exists "coach edits notes" on public.coach_notes;
create policy "coach edits notes" on public.coach_notes for update to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid() and public.is_coach_of(trainee_id));

notify pgrst, 'reload schema';

-- Trainees without the app ("managed") ---------------------------------------------------------------------------
-- A coach can coach someone who never installs GymLog: create_managed_trainee() makes a placeholder account that
-- cannot sign in, linked to the coach. The coach builds their plan and logs their workouts and weight. If the
-- person later signs in with Google and enters the link's code (Settings -> My coach), accept_coach_invite() moves
-- everything onto their own account and removes the placeholder.
alter table public.coach_links add column if not exists managed boolean not null default false;

create or replace function public.create_managed_trainee(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  person uuid := gen_random_uuid();
  link uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Give them a name' using errcode = '22023';
  end if;
  insert into auth.users (instance_id, id, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', person, 'authenticated', 'authenticated',
          jsonb_build_object('provider', 'managed'), jsonb_build_object('managed_by', me, 'name', trim(p_name)), now(), now());
  insert into public.coach_links (coach_id, trainee_id, name, status, managed, accepted_at)
  values (me, person, trim(p_name), 'active', true, now())
  returning id into link;
  return link;
end;
$$;
revoke all on function public.create_managed_trainee(text) from public;
revoke all on function public.create_managed_trainee(text) from anon;
grant execute on function public.create_managed_trainee(text) to authenticated;

-- true when the signed-in coach logs for this (app-less) person
create or replace function public.is_managing(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coach_links
     where coach_id = auth.uid() and trainee_id = p_user and status = 'active' and managed
  )
$$;
revoke all on function public.is_managing(uuid) from public;
revoke all on function public.is_managing(uuid) from anon;
grant execute on function public.is_managing(uuid) to authenticated;

-- the coach logs workouts and weigh-ins for a managed trainee
do $$
declare t text;
begin
  foreach t in array array['sessions', 'metrics'] loop
    execute format('drop policy if exists "coach logs" on public.%I', t);
    execute format('create policy "coach logs" on public.%I for insert to authenticated with check (public.is_managing(user_id))', t);
    execute format('drop policy if exists "coach fixes logs" on public.%I', t);
    execute format('create policy "coach fixes logs" on public.%I for update to authenticated using (public.is_managing(user_id)) with check (public.is_managing(user_id))', t);
    execute format('drop policy if exists "coach removes logs" on public.%I', t);
    execute format('create policy "coach removes logs" on public.%I for delete to authenticated using (public.is_managing(user_id))', t);
  end loop;
end $$;

-- the invite code now also claims a managed trainee: their training moves onto the signed-in account
create or replace function public.accept_coach_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  l public.coach_links%rowtype;
  placeholder uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into l from public.coach_links
   where code = upper(trim(p_code)) and coach_id <> me and (status = 'invited' or (status = 'active' and managed))
   for update;
  if not found then
    raise exception 'No invite with that code' using errcode = 'P0002';
  end if;
  if l.managed then
    placeholder := l.trainee_id;
    update public.exercises set user_id = me where user_id = placeholder;
    update public.workouts set user_id = me where user_id = placeholder;
    update public.workout_exercises set user_id = me where user_id = placeholder;
    update public.sessions set user_id = me where user_id = placeholder;
    update public.metrics set user_id = me where user_id = placeholder;
    if exists (select 1 from public.coach_links where coach_id = l.coach_id and trainee_id = me and status = 'active' and id <> l.id) then
      -- already coached by this coach: one link is enough
      delete from public.coach_links where id = l.id;
    else
      update public.coach_links
         set trainee_id = me, managed = false, accepted_at = now(), trainee_email = (select email from auth.users where id = me)
       where id = l.id;
    end if;
    delete from auth.users where id = placeholder and raw_app_meta_data ->> 'provider' = 'managed';
  elsif exists (select 1 from public.coach_links where coach_id = l.coach_id and trainee_id = me and status = 'active') then
    -- already coached by this coach: the extra invite is not needed
    delete from public.coach_links where id = l.id;
  else
    update public.coach_links
       set trainee_id = me, status = 'active', accepted_at = now(), trainee_email = (select email from auth.users where id = me)
     where id = l.id;
  end if;
  return l.id;
end;
$$;
revoke all on function public.accept_coach_invite(text) from public;
revoke all on function public.accept_coach_invite(text) from anon;
grant execute on function public.accept_coach_invite(text) to authenticated;

-- the coach removes a managed trainee and everything logged for them
create or replace function public.delete_managed_trainee(p_link uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  person uuid;
begin
  select trainee_id into person from public.coach_links where id = p_link and coach_id = auth.uid() and managed;
  if person is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  -- their rows and the link go with the placeholder account (on delete cascade)
  delete from auth.users where id = person and raw_app_meta_data ->> 'provider' = 'managed';
end;
$$;
revoke all on function public.delete_managed_trainee(uuid) from public;
revoke all on function public.delete_managed_trainee(uuid) from anon;
grant execute on function public.delete_managed_trainee(uuid) to authenticated;

-- the guard also keeps `managed` out of reach of plain updates
create or replace function public.coach_links_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.coach_id <> old.coach_id
       or new.trainee_id is distinct from old.trainee_id
       or new.code <> old.code
       or new.trainee_email is distinct from old.trainee_email
       or new.accepted_at is distinct from old.accepted_at
       or new.created_at <> old.created_at
       or new.managed <> old.managed then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.status <> old.status and new.status <> 'ended' then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
