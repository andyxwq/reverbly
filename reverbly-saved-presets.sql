-- Reverbly saved presets. Run once in Supabase > SQL Editor.
-- Presets are linked to the signed-in user and are available for Trial and Pro plans.

create table if not exists public.saved_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  speed numeric(4,2) not null check (speed between 0.6 and 1.4),
  reverb integer not null check (reverb between 0 and 100),
  fade_in numeric(3,1) not null default 0 check (fade_in between 0 and 5),
  fade_out numeric(3,1) not null default 0 check (fade_out between 0 and 5),
  loop_seconds integer not null default 0 check (loop_seconds in (0, 15, 30, 45, 60)),
  created_at timestamptz not null default now()
);

alter table public.saved_presets enable row level security;

drop policy if exists "Users can read their saved presets" on public.saved_presets;
create policy "Users can read their saved presets"
  on public.saved_presets for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Trial and Pro users can save presets" on public.saved_presets;
create policy "Trial and Pro users can save presets"
  on public.saved_presets for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and plan in ('trialing', 'pro')
    )
  );

drop policy if exists "Users can delete their saved presets" on public.saved_presets;
create policy "Users can delete their saved presets"
  on public.saved_presets for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists saved_presets_user_created_at_idx
  on public.saved_presets (user_id, created_at desc);
