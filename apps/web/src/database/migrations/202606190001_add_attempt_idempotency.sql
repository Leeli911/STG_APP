alter table if exists public.attempts
  add column if not exists idempotency_key text;

update public.attempts
set idempotency_key = id::text
where idempotency_key is null;

alter table if exists public.attempts
  alter column idempotency_key set not null;

alter table if exists public.attempts
  add column if not exists client_started_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attempts_user_idempotency_key_unique'
  ) then
    alter table public.attempts
      add constraint attempts_user_idempotency_key_unique unique (
        user_id,
        idempotency_key
      );
  end if;
end
$$;
