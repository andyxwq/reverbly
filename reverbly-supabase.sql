-- Reverbly: run this once in Supabase > SQL Editor > New query.
-- It creates only user metadata. Audio remains processed locally in the browser.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'trialing', 'pro')),
  export_date date,
  export_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null,
  output_name text not null,
  preset text not null,
  speed numeric(4,2) not null,
  reverb integer not null check (reverb between 0 and 100),
  loop_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'canceled', 'past_due')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.exports enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users can read their exports" on public.exports;
create policy "Users can read their exports" on public.exports for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their exports" on public.exports;
create policy "Users can create their exports" on public.exports for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their subscription" on public.subscriptions;
create policy "Users can read their subscription" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
