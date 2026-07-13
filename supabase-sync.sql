-- 在 Supabase SQL Editor 中运行一次。
-- 表不向 anon 角色直接开放，只能通过两个按同步码读取/写入的函数访问。
create table if not exists public.shici_sync (
  sync_id text primary key,
  payload text not null,
  updated_at timestamptz not null default now()
);

alter table public.shici_sync enable row level security;
revoke all on table public.shici_sync from anon, authenticated;

create or replace function public.get_sync(p_sync_id text)
returns table(payload text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.payload, s.updated_at
  from public.shici_sync s
  where s.sync_id = p_sync_id
  limit 1;
$$;

create or replace function public.put_sync(p_sync_id text, p_payload text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_sync_id) < 20 or length(p_payload) < 20 then
    raise exception 'invalid sync payload';
  end if;
  insert into public.shici_sync(sync_id,payload,updated_at)
  values(p_sync_id,p_payload,now())
  on conflict(sync_id) do update
  set payload=excluded.payload, updated_at=excluded.updated_at;
end;
$$;

revoke all on function public.get_sync(text) from public;
revoke all on function public.put_sync(text,text) from public;
grant execute on function public.get_sync(text) to anon, authenticated;
grant execute on function public.put_sync(text,text) to anon, authenticated;
