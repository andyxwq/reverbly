-- Reverbly export access rules. Run once in Supabase > SQL Editor.
-- This replaces the broad profile-update rule with a safe server-side export check.

drop policy if exists "Users can update their profile" on public.profiles;

create table if not exists public.anonymous_export_usage (
  id text primary key,
  export_date date not null default current_date,
  export_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.consume_export()
returns table (allowed boolean, plan text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
begin
  select * into profile_row
  from public.profiles
  where id = auth.uid()
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if profile_row.plan in ('trialing', 'pro') then
    return query select true, profile_row.plan, 'Unlimited export available.';
    return;
  end if;

  if profile_row.export_date is distinct from current_date then
    update public.profiles
    set export_date = current_date, export_count = 1, updated_at = now()
    where id = auth.uid();
    return query select true, 'free'::text, 'Your free export for today is ready.';
    return;
  end if;

  if profile_row.export_count < 1 then
    update public.profiles
    set export_count = export_count + 1, updated_at = now()
    where id = auth.uid();
    return query select true, 'free'::text, 'Your free export for today is ready.';
    return;
  end if;

  return query select false, 'free'::text, 'Your free export has been used for today. Start a trial for unlimited exports.';
end;
$$;

create or replace function public.consume_export_anonymous(p_client_id text)
returns table (allowed boolean, plan text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_row public.anonymous_export_usage%rowtype;
  inserted_row_count integer := 0;
begin
  if p_client_id is null or length(trim(p_client_id)) < 1 then
    return query select false, 'free'::text, 'Anonymous export quota could not be validated.';
    return;
  end if;

  select * into usage_row
  from public.anonymous_export_usage
  where id = p_client_id
  for update;

  if not found then
    insert into public.anonymous_export_usage (id, export_date, export_count)
    values (p_client_id, current_date, 1)
    on conflict (id) do nothing;

    get diagnostics inserted_row_count = ROW_COUNT;
    if inserted_row_count = 1 then
      return query select true, 'free'::text, 'Your free export is ready.';
      return;
    end if;

    select * into usage_row
    from public.anonymous_export_usage
    where id = p_client_id
    for update;
  end if;

  if usage_row.export_date is distinct from current_date then
    update public.anonymous_export_usage
    set export_date = current_date, export_count = 1, updated_at = now()
    where id = p_client_id;
    return query select true, 'free'::text, 'Your free export is ready.';
    return;
  end if;

  if usage_row.export_count < 1 then
    update public.anonymous_export_usage
    set export_count = export_count + 1, updated_at = now()
    where id = p_client_id;
    return query select true, 'free'::text, 'Your free export is ready.';
    return;
  end if;

  return query select false, 'free'::text, 'Your free export for today has been used. Create an account to start a trial with unlimited exports.';
end;
$$;

revoke all on function public.consume_export() from public;
grant execute on function public.consume_export() to authenticated;
revoke all on function public.consume_export_anonymous(text) from public;
grant execute on function public.consume_export_anonymous(text) to anon, authenticated;
