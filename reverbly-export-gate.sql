-- Reverbly export access rules. Run once in Supabase > SQL Editor.
-- This replaces the broad profile-update rule with a safe server-side export check.

drop policy if exists "Users can update their profile" on public.profiles;

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

revoke all on function public.consume_export() from public;
grant execute on function public.consume_export() to authenticated;
